"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { CARD_CR80 } from "@/lib/constants";
import type { MemberType, TemplateSide } from "@/lib/types";

async function ctx() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase
    .from("app_users")
    .select("school_id")
    .eq("id", user.id)
    .single();
  return { supabase, user, schoolId: (profile?.school_id ?? null) as string | null };
}

export async function createBlankTemplate() {
  const { supabase, schoolId, user } = await ctx();
  if (!schoolId) redirect("/templates?error=No+school+assigned");
  const { data, error } = await supabase
    .from("id_templates")
    .insert({
      school_id: schoolId,
      name: "Untitled template",
      width_mm: CARD_CR80.widthMm,
      height_mm: CARD_CR80.heightMm,
      dpi: CARD_CR80.dpi,
      orientation: "landscape",
      front: { background: "#ffffff", elements: [] },
      back: { background: "#ffffff", elements: [] },
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !data)
    redirect(`/templates?error=${encodeURIComponent(error?.message ?? "Create failed")}`);

  await logAudit(supabase, {
    schoolId,
    actorId: user.id,
    action: "template.created",
    targetType: "template",
    targetId: data.id,
  });

  redirect(`/templates/${data.id}/edit`);
}

export async function saveTemplate(
  id: string,
  payload: { name: string; front: TemplateSide; back: TemplateSide },
): Promise<{ ok: boolean; error?: string }> {
  const { supabase } = await ctx();
  const name = (payload.name || "Untitled template").slice(0, 120);
  const { error } = await supabase
    .from("id_templates")
    .update({ name, front: payload.front, back: payload.back })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/templates");
  revalidatePath(`/templates/${id}/edit`);
  return { ok: true };
}

export async function deleteTemplate(id: string) {
  const { supabase, schoolId, user } = await ctx();
  await supabase.from("id_templates").delete().eq("id", id);
  await logAudit(supabase, {
    schoolId,
    actorId: user.id,
    action: "template.deleted",
    targetType: "template",
    targetId: id,
  });
  revalidatePath("/templates");
}

export async function setDefaultTemplate(id: string) {
  const { supabase, schoolId } = await ctx();
  if (!schoolId) return;
  await supabase.from("id_templates").update({ is_default: false }).eq("school_id", schoolId);
  await supabase.from("id_templates").update({ is_default: true }).eq("id", id);
  revalidatePath("/templates");
}

/**
 * Makes one template the school-wide default for every student or staff card
 * (schools.student_template_id / staff_template_id — migration 0003).
 */
export async function setSchoolTemplate(templateId: string, kind: "student" | "staff") {
  const { supabase, schoolId } = await ctx();
  if (!schoolId) redirect("/templates?error=No+school+assigned");

  // The template must belong to this school AND be designed for `kind`.
  const { data: tpl } = await supabase
    .from("id_templates")
    .select("id, member_type")
    .eq("id", templateId)
    .eq("school_id", schoolId)
    .single<{ id: string; member_type: MemberType }>();
  if (!tpl) redirect("/templates?error=Template+not+found");
  if (tpl.member_type !== kind)
    redirect(
      `/templates?error=${encodeURIComponent(
        `That is a ${tpl.member_type} template — it can't be the school ${kind} template`,
      )}`,
    );

  const column = kind === "staff" ? "staff_template_id" : "student_template_id";
  const { error } = await supabase
    .from("schools")
    .update({ [column]: templateId })
    .eq("id", schoolId);
  if (error) redirect(`/templates?error=${encodeURIComponent(error.message)}`);

  revalidatePath("/templates");
  redirect("/templates?ok=Template+applied+to+the+whole+school");
}

export async function duplicateTemplate(id: string) {
  const { supabase, schoolId, user } = await ctx();
  if (!schoolId) return;
  const { data: src } = await supabase.from("id_templates").select("*").eq("id", id).single();
  if (!src) return;
  await supabase.from("id_templates").insert({
    school_id: schoolId,
    name: `${src.name} (copy)`,
    width_mm: src.width_mm,
    height_mm: src.height_mm,
    dpi: src.dpi,
    orientation: src.orientation,
    front: src.front,
    back: src.back,
    is_default: false,
    created_by: user.id,
  });
  revalidatePath("/templates");
}

/** The source-template shape copied into each target school. */
interface PushableTemplate {
  id: string;
  school_id: string;
  name: string;
  member_type: MemberType;
  width_mm: number;
  height_mm: number;
  dpi: number;
  orientation: "landscape" | "portrait";
  front: TemplateSide;
  back: TemplateSide;
}

/**
 * Copy one template into other schools (super_admin only).
 * Targets already owning a same-named template are updated in place; the rest
 * receive a fresh copy. The source template's own school is always skipped.
 */
export async function pushTemplateToSchools(
  templateId: string,
  target: string[] | "all",
): Promise<{ ok: number; error: string | null }> {
  const me = await requireRole(["super_admin"]);
  const admin = createAdminClient();

  const { data: src } = await admin
    .from("id_templates")
    .select("id, school_id, name, member_type, width_mm, height_mm, dpi, orientation, front, back")
    .eq("id", templateId)
    .single<PushableTemplate>();
  if (!src) return { ok: 0, error: "Template not found" };

  // Resolve target school ids — never the source template's own school.
  let targetIds: string[];
  if (target === "all") {
    const { data: schools } = await admin.from("schools").select("id").neq("id", src.school_id);
    targetIds = ((schools ?? []) as { id: string }[]).map((s) => s.id);
  } else {
    targetIds = target.filter((id) => id !== src.school_id);
  }

  const fields = {
    member_type: src.member_type,
    width_mm: src.width_mm,
    height_mm: src.height_mm,
    dpi: src.dpi,
    orientation: src.orientation,
    front: src.front,
    back: src.back,
  };

  let count = 0;
  for (const schoolId of targetIds) {
    const { data: existing } = await admin
      .from("id_templates")
      .select("id")
      .eq("school_id", schoolId)
      .eq("name", src.name)
      .maybeSingle<{ id: string }>();

    const { error } = existing
      ? await admin.from("id_templates").update(fields).eq("id", existing.id)
      : await admin
          .from("id_templates")
          .insert({ school_id: schoolId, name: src.name, ...fields, is_default: false, created_by: null });
    if (!error) count += 1;
  }

  await logAudit(admin, {
    schoolId: me.school_id,
    actorId: me.id,
    action: "template.pushed",
    targetType: "template",
    targetId: templateId,
    meta: { name: src.name, count },
  });

  revalidatePath("/templates");
  return { ok: count, error: null };
}
