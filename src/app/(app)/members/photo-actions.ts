"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Auth + school guard shared with the other member actions (mirrors actions.ts).
 * Redirects to /login when not authenticated, so callers can assume a user.
 */
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

/**
 * Uploads a single member photo to the public `photos` bucket and returns its
 * public URL. Called from PhotoField after a file pick or a PhotoCapture crop.
 */
export async function uploadMemberPhoto(fd: FormData): Promise<{ url: string }> {
  const { supabase, schoolId } = await ctx();
  if (!schoolId) throw new Error("No school assigned to your account");

  const file = fd.get("photo") as File | null;
  if (!file || typeof file === "string") throw new Error("No photo provided");
  if (!file.type.startsWith("image/")) throw new Error("Please choose an image file");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const path = `${schoolId}/${crypto.randomUUID()}.jpg`;

  const { error } = await supabase.storage
    .from("photos")
    .upload(path, bytes, { upsert: true, contentType: file.type || "image/jpeg" });
  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from("photos").getPublicUrl(path);
  return { url: data.publicUrl };
}
