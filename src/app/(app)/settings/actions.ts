"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";

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
