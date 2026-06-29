"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { memberSchema, classSchema, formToObject } from "@/lib/validators";

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
  const { supabase, schoolId } = await ctx();
  if (!schoolId) redirect("/members?error=No+school+assigned+to+your+account");
  const r = memberSchema.safeParse(formToObject(fd));
  if (!r.success)
    redirect(`/members/new?error=${encodeURIComponent(r.error.issues[0].message)}`);
  const { error } = await supabase
    .from("members")
    .insert({ ...r.data, school_id: schoolId });
  if (error) redirect(`/members/new?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/members");
  redirect("/members?ok=Member+added");
}

export async function updateMember(id: string, fd: FormData) {
  const { supabase } = await ctx();
  const r = memberSchema.safeParse(formToObject(fd));
  if (!r.success)
    redirect(`/members/${id}/edit?error=${encodeURIComponent(r.error.issues[0].message)}`);
  const { error } = await supabase.from("members").update(r.data).eq("id", id);
  if (error)
    redirect(`/members/${id}/edit?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/members");
  redirect("/members?ok=Member+updated");
}

export async function deleteMember(id: string) {
  const { supabase } = await ctx();
  await supabase.from("members").delete().eq("id", id);
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
