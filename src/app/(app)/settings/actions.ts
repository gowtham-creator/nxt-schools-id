"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth";

const LOGO_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/svg+xml": "svg",
  "image/webp": "webp",
};

/**
 * Upload the school logo to the public `logos` bucket and save its URL.
 * Admin+ only; the path is scoped to the caller's school. A fresh filename is
 * used per upload so CDN caches never serve a stale logo.
 */
export async function uploadSchoolLogo(fd: FormData) {
  const profile = await requireRole(["super_admin", "admin"]);
  if (!profile.school_id) redirect("/settings?error=No+school+assigned+to+your+account");

  const file = fd.get("logo");
  if (!(file instanceof File) || file.size === 0) {
    redirect("/settings?error=Choose+a+logo+file+first");
  }
  const ext = LOGO_TYPES[file.type];
  if (!ext) redirect("/settings?error=Logo+must+be+PNG%2C+JPG%2C+SVG+or+WebP");
  if (file.size > 2 * 1024 * 1024) redirect("/settings?error=Logo+must+be+under+2+MB");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const admin = createAdminClient();
  const path = `${profile.school_id}/logo-${new (globalThis.Date)().getTime()}.${ext}`;
  const { error: upErr } = await admin.storage
    .from("logos")
    .upload(path, bytes, { upsert: true, contentType: file.type });
  if (upErr) redirect(`/settings?error=${encodeURIComponent(`Upload failed: ${upErr.message}`)}`);

  const { data: pub } = admin.storage.from("logos").getPublicUrl(path);
  const supabase = await createClient();
  const { error } = await supabase
    .from("schools")
    .update({ logo_url: pub.publicUrl, updated_at: new (globalThis.Date)().toISOString() })
    .eq("id", profile.school_id);
  if (error) redirect(`/settings?error=${encodeURIComponent(error.message)}`);

  revalidatePath("/settings");
  revalidatePath("/templates");
  revalidatePath("/dashboard");
  // NOTE: keep redirect targets ASCII-safe — the URL travels in the
  // x-action-redirect header, and raw non-ASCII throws ERR_INVALID_CHAR.
  redirect(`/settings?ok=${encodeURIComponent("Logo updated - it now appears on every generated card")}`);
}

/** Trim a form value; empty string -> null (so blanked-out fields clear the column). */
function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
}

/**
 * Update the caller's school profile. Admin+ only.
 * school_id is taken from the authenticated profile (never trusted from the form).
 */
export async function updateSchool(fd: FormData) {
  const profile = await requireRole(["super_admin", "admin"]);
  if (!profile.school_id) redirect("/settings?error=No+school+assigned+to+your+account");

  const supabase = await createClient();
  const now = new (globalThis.Date)().toISOString();

  const { error } = await supabase
    .from("schools")
    .update({
      name: str(fd, "name") ?? "",
      short_name: str(fd, "short_name"),
      academic_year: str(fd, "academic_year"),
      address: str(fd, "address"),
      phone: str(fd, "phone"),
      email: str(fd, "email"),
      primary_color: str(fd, "primary_color"),
      secondary_color: str(fd, "secondary_color"),
      updated_at: now,
    })
    .eq("id", profile.school_id);

  if (error) redirect(`/settings?error=${encodeURIComponent(error.message)}`);

  revalidatePath("/settings");
  redirect("/settings?ok=Saved");
}
