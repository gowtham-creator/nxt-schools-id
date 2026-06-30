"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formToObject } from "@/lib/validators";

const emptyToNull = (v: unknown) => (v === "" || v === undefined ? null : v);

const branchSchema = z.object({
  name: z.string().trim().min(1, "Branch name is required").max(120),
  email: z.preprocess(emptyToNull, z.string().email("Invalid email").nullable()),
  phone: z.preprocess(emptyToNull, z.string().trim().max(30).nullable()),
  address: z.preprocess(emptyToNull, z.string().trim().max(300).nullable()),
});

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

export async function createBranch(fd: FormData) {
  const { supabase, schoolId } = await ctx();
  if (!schoolId) redirect("/branches?error=No+school+assigned+to+your+account");
  const r = branchSchema.safeParse(formToObject(fd));
  if (!r.success)
    redirect(`/branches?error=${encodeURIComponent(r.error.issues[0].message)}`);
  const { error } = await supabase
    .from("branches")
    .insert({ ...r.data, school_id: schoolId });
  if (error) redirect(`/branches?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/branches");
  redirect("/branches?ok=Branch+added");
}

export async function updateBranch(id: string, fd: FormData) {
  const { supabase } = await ctx();
  const r = branchSchema.safeParse(formToObject(fd));
  if (!r.success)
    redirect(`/branches/${id}?error=${encodeURIComponent(r.error.issues[0].message)}`);
  const { error } = await supabase.from("branches").update(r.data).eq("id", id);
  if (error)
    redirect(`/branches/${id}?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/branches");
  revalidatePath(`/branches/${id}`);
  redirect("/branches?ok=Branch+updated");
}

export async function deleteBranch(id: string) {
  const { supabase } = await ctx();
  await supabase.from("branches").delete().eq("id", id);
  revalidatePath("/branches");
}

export async function setBranchStatus(id: string, status: "active" | "inactive") {
  const { supabase } = await ctx();
  await supabase.from("branches").update({ status }).eq("id", id);
  revalidatePath("/branches");
  revalidatePath(`/branches/${id}`);
}
