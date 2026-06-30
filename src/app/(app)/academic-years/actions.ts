"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { academicYearSchema, formToObject } from "@/lib/validators";

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

export async function createAcademicYear(fd: FormData) {
  const { supabase, schoolId } = await ctx();
  if (!schoolId) redirect("/academic-years?error=No+school+assigned+to+your+account");
  const r = academicYearSchema.safeParse(formToObject(fd));
  if (!r.success)
    redirect(`/academic-years?error=${encodeURIComponent(r.error.issues[0].message)}`);
  // Only one year can be current — clear the rest before flagging this one.
  if (r.data.is_current) {
    await supabase
      .from("academic_years")
      .update({ is_current: false })
      .eq("school_id", schoolId);
  }
  const { error } = await supabase
    .from("academic_years")
    .insert({ ...r.data, school_id: schoolId });
  if (error) redirect(`/academic-years?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/academic-years");
  redirect("/academic-years?ok=Academic+year+added");
}

export async function setCurrentYear(id: string) {
  const { supabase, schoolId } = await ctx();
  if (!schoolId) redirect("/academic-years?error=No+school+assigned+to+your+account");
  await supabase
    .from("academic_years")
    .update({ is_current: false })
    .eq("school_id", schoolId);
  const { error } = await supabase
    .from("academic_years")
    .update({ is_current: true })
    .eq("id", id);
  if (error) redirect(`/academic-years?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/academic-years");
  redirect("/academic-years?ok=Current+year+updated");
}

export async function deleteAcademicYear(id: string) {
  const { supabase } = await ctx();
  await supabase.from("academic_years").delete().eq("id", id);
  revalidatePath("/academic-years");
}
