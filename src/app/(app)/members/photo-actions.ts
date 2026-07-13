"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { versionedPublicUrl, photoPathFromUrl } from "./photo-utils";

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

/** Server-side photo size cap (bytes) — client-side resizing can be bypassed. */
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

/** Remove the given object paths from the photos bucket. Best-effort. */
async function removeObjects(supabase: SupabaseClient, paths: string[]) {
  const unique = [...new Set(paths.filter(Boolean))];
  if (!unique.length) return;
  try {
    await supabase.storage.from("photos").remove(unique);
  } catch {
    /* never let storage cleanup block the primary DB change */
  }
}

/**
 * Uploads a single member photo to the public `photos` bucket and returns its
 * versioned public URL. Called from PhotoField after a file pick or a
 * PhotoCapture crop. When a `member_id` is present (editing an existing
 * member) the photo is written to a stable per-member path (overwritten, so no
 * orphans) and persisted immediately; new members use a random path.
 * Returns `{url, error}` (never throws for expected failures).
 */
export async function uploadMemberPhoto(
  fd: FormData,
): Promise<{ url: string | null; error: string | null }> {
  const { supabase, schoolId } = await ctx();
  if (!schoolId) return { url: null, error: "No school assigned to your account" };

  const file = fd.get("photo") as File | null;
  if (!file || typeof file === "string") return { url: null, error: "No photo provided" };
  if (!file.type.startsWith("image/"))
    return { url: null, error: "Please choose an image file" };
  if (file.size > MAX_PHOTO_BYTES)
    return { url: null, error: "Photo is too large — maximum size is 10 MB" };

  const memberId = ((fd.get("member_id") as string | null) || "").trim() || null;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const path = memberId
    ? `${schoolId}/${memberId}.jpg`
    : `${schoolId}/${crypto.randomUUID()}.jpg`;

  const { error } = await supabase.storage.from("photos").upload(path, bytes, {
    upsert: true,
    contentType: file.type || "image/jpeg",
    cacheControl: "31536000",
  });
  if (error) return { url: null, error: error.message };

  const { data } = supabase.storage.from("photos").getPublicUrl(path);
  const url = versionedPublicUrl(data.publicUrl);

  // For an existing member, persist right away so the change sticks even if the
  // surrounding form is closed without pressing Save.
  if (memberId) {
    await supabase
      .from("members")
      .update({ photo_url: url })
      .eq("id", memberId)
      .eq("school_id", schoolId);
    revalidatePath("/members");
  }
  return { url, error: null };
}

/**
 * Removes a member's photo: deletes the underlying storage object(s) and clears
 * members.photo_url. Idempotent and best-effort on storage so a missing object
 * never blocks clearing the field.
 */
export async function removeMemberPhoto(
  memberId: string,
): Promise<{ ok: boolean; error: string | null }> {
  const { supabase, schoolId } = await ctx();
  if (!schoolId) return { ok: false, error: "No school assigned to your account" };

  const { data: member } = await supabase
    .from("members")
    .select("photo_url")
    .eq("id", memberId)
    .eq("school_id", schoolId)
    .single();

  await removeObjects(supabase, [
    `${schoolId}/${memberId}.jpg`,
    photoPathFromUrl(member?.photo_url) ?? "",
  ]);

  const { error } = await supabase
    .from("members")
    .update({ photo_url: null })
    .eq("id", memberId)
    .eq("school_id", schoolId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/members");
  return { ok: true, error: null };
}
