"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { CARD_CR80 } from "@/lib/constants";
import type { TemplateSide } from "@/lib/types";

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
