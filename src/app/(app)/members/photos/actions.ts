"use server";

import { revalidatePath } from "next/cache";
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

type MemberKey = { id: string; identifier: string | null; roll_no: string | null };

export type BulkUploadResult = {
  total: number;
  matched: number;
  unmatched: string[];
};

/** Strip the extension off a filename and trim surrounding whitespace. */
function keyFromFilename(name: string): string {
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  return base.trim();
}

/**
 * Skolors-style bulk photo attach: each file is named by the member's Admission
 * No or Roll No (e.g. `NXT-2025-001.jpg`). We match case-insensitively, upload
 * matched files to the public `photos` bucket at `${schoolId}/${memberId}.jpg`,
 * and set members.photo_url. Returns match counts + unmatched filenames.
 */
export async function bulkUploadPhotos(fd: FormData): Promise<BulkUploadResult> {
  const { supabase, schoolId } = await ctx();
  if (!schoolId) throw new Error("No school assigned to your account");

  const files = fd.getAll("photos") as File[];

  const { data: members, error: membersErr } = await supabase
    .from("members")
    .select("id,identifier,roll_no")
    .eq("school_id", schoolId);
  if (membersErr) throw new Error(membersErr.message);

  // Build a case-insensitive lookup from identifier/roll_no to member id.
  const byKey = new Map<string, string>();
  for (const m of (members ?? []) as MemberKey[]) {
    if (m.identifier) byKey.set(m.identifier.trim().toLowerCase(), m.id);
    if (m.roll_no) byKey.set(m.roll_no.trim().toLowerCase(), m.id);
  }

  let matched = 0;
  const unmatched: string[] = [];

  for (const file of files) {
    if (!file || typeof file === "string") continue;
    const key = keyFromFilename(file.name).toLowerCase();
    const memberId = key ? byKey.get(key) : undefined;
    if (!memberId) {
      unmatched.push(file.name);
      continue;
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const path = `${schoolId}/${memberId}.jpg`;
    const { error: uploadErr } = await supabase.storage
      .from("photos")
      .upload(path, bytes, { upsert: true, contentType: file.type || "image/jpeg" });
    if (uploadErr) {
      unmatched.push(file.name);
      continue;
    }

    const { data } = supabase.storage.from("photos").getPublicUrl(path);
    const { error: updateErr } = await supabase
      .from("members")
      .update({ photo_url: data.publicUrl })
      .eq("id", memberId);
    if (updateErr) {
      unmatched.push(file.name);
      continue;
    }
    matched += 1;
  }

  revalidatePath("/members");
  return { total: files.length, matched, unmatched };
}
