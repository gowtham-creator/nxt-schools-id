"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTrialStatus } from "@/lib/trial";

const RESTRICTED_MSG =
  "Access restricted: your time-limited access has ended. Please contact NXT Schools.";

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  // Block sign-in for a school whose access-time budget is used up.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { data: prof } = await supabase
      .from("app_users")
      .select("school_id, role")
      .eq("id", user.id)
      .single();
    if (prof && prof.role !== "super_admin" && prof.school_id) {
      const trial = await getTrialStatus(prof.school_id as string);
      if (trial?.expired) {
        await supabase.auth.signOut();
        redirect(`/login?error=${encodeURIComponent(RESTRICTED_MSG)}`);
      }
    }
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signup(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("full_name") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }
  redirect("/login?message=Account created. Confirm your email if required, then sign in.");
}
