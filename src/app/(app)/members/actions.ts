"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { memberSchema, classSchema, formToObject } from "@/lib/validators";

/** Read a string field from FormData (non-strings / missing -> ""). */
function field(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v : "";
}

/**
 * Find (or create) the class row for a grade + section within a school and
 * return its id. Empty grade -> null (member has no class). Uses the service
 * role so a class can be created even when the caller lacks INSERT on classes;
 * always scoped explicitly to the caller's school_id.
 */
async function resolveClassId(
  schoolId: string,
  grade: string,
  section: string,
): Promise<string | null> {
  const name = grade.trim();
  if (!name) return null;
  const sec = section.trim() || null;
  const admin = createAdminClient();

  const base = admin.from("classes").select("id").eq("school_id", schoolId).eq("name", name);
  const { data: found } = await (sec ? base.eq("section", sec) : base.is("section", null)).maybeSingle();
  if (found) return found.id as string;

  const { data: created } = await admin
    .from("classes")
    .insert({ school_id: schoolId, name, section: sec })
    .select("id")
    .single();
  return (created?.id as string | undefined) ?? null;
}

async function ctx() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase
    .from("app_users")
    .select("school_id, role")
    .eq("id", user.id)
    .single();
  return { supabase, user, schoolId: (profile?.school_id ?? null) as string | null };
}

export async function createMember(fd: FormData) {
  const { supabase, schoolId, user } = await ctx();
  if (!schoolId) redirect("/members?error=No+school+assigned+to+your+account");
  const r = memberSchema.safeParse(formToObject(fd));
  if (!r.success)
    redirect(`/members/new?error=${encodeURIComponent(r.error.issues[0].message)}`);
  const class_id = await resolveClassId(schoolId, field(fd, "class_grade"), field(fd, "class_section"));
  const { error } = await supabase
    .from("members")
    .insert({ ...r.data, class_id, school_id: schoolId });
  if (error) redirect(`/members/new?error=${encodeURIComponent(error.message)}`);

  await logAudit(supabase, {
    schoolId,
    actorId: user.id,
    action: "member.created",
    targetType: "member",
    meta: {
      member_type: r.data.member_type,
      identifier: r.data.identifier ?? null,
      first_name: r.data.first_name,
      last_name: r.data.last_name ?? null,
    },
  });

  revalidatePath("/members");
  redirect("/members?ok=Member+added");
}

export async function updateMember(id: string, fd: FormData) {
  const { supabase, schoolId } = await ctx();
  const r = memberSchema.safeParse(formToObject(fd));
  if (!r.success)
    redirect(`/members/${id}/edit?error=${encodeURIComponent(r.error.issues[0].message)}`);
  const class_id = schoolId
    ? await resolveClassId(schoolId, field(fd, "class_grade"), field(fd, "class_section"))
    : null;
  const { error } = await supabase.from("members").update({ ...r.data, class_id }).eq("id", id);
  if (error)
    redirect(`/members/${id}/edit?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/members");
  redirect("/members?ok=Member+updated");
}

export async function deleteMember(id: string) {
  const { supabase, schoolId, user } = await ctx();
  await supabase.from("members").delete().eq("id", id);
  await logAudit(supabase, {
    schoolId,
    actorId: user.id,
    action: "member.deleted",
    targetType: "member",
    targetId: id,
  });
  revalidatePath("/members");
}

export async function createClass(fd: FormData) {
  const { supabase, schoolId } = await ctx();
  if (!schoolId) redirect("/members?error=No+school");
  const r = classSchema.safeParse(formToObject(fd));
  if (!r.success)
    redirect(`/members/new?error=${encodeURIComponent(r.error.issues[0].message)}`);
  const { error } = await supabase
    .from("classes")
    .insert({ ...r.data, school_id: schoolId });
  if (error) redirect(`/members/new?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/members/new");
  revalidatePath("/members");
  redirect("/members/new?ok=Class+added");
}
