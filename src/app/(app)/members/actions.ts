"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { memberSchema, classSchema, formToObject } from "@/lib/validators";
import { isSectionlessGrade } from "@/lib/constants";

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
  // Nursery / UKG are deliberately section-less — ignore any section chosen for
  // them so "Nursery A" / "UKG B" can never be created again.
  const sec = isSectionlessGrade(name) ? null : section.trim() || null;
  const admin = createAdminClient();

  // Match case-insensitively and take the FIRST existing row (limit 1, never
  // maybeSingle). The old exact-match + maybeSingle created a runaway: "Nursery"
  // vs "NURSERY" were treated as different, and once two duplicates existed
  // maybeSingle errored so every new member spawned yet another duplicate class.
  let base = admin
    .from("classes")
    .select("id")
    .eq("school_id", schoolId)
    .ilike("name", name)
    .order("created_at", { ascending: true })
    .limit(1);
  base = sec ? base.ilike("section", sec) : base.is("section", null);
  const { data: found } = await base;
  if (found && found.length > 0) return found[0].id as string;

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
  // Class is mandatory for students (the team filters by it) — enforce server-side
  // too, since the form's `required` can be bypassed.
  if (r.data.member_type === "student" && !class_id)
    redirect(`/members/new?error=${encodeURIComponent("Class is required for students.")}`);
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
  if (r.data.member_type === "student" && !class_id)
    redirect(`/members/${id}/edit?error=${encodeURIComponent("Class is required for students.")}`);
  // The member's photo is uploaded/removed by <PhotoField> through its own action
  // and is NOT a field on this form. If we let the parsed schema (which fills the
  // absent `photo_url` with null) into the update, every edit would silently WIPE
  // the member's photo — and its generated card. Drop it so the edit only touches
  // the fields the form actually owns.
  const { photo_url: _managedSeparately, ...formFields } = r.data;
  void _managedSeparately;
  const { error } = await supabase
    .from("members")
    .update({ ...formFields, class_id })
    .eq("id", id);
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
