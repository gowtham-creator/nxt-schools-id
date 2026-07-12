import "server-only";

import { cookies } from "next/headers";

/**
 * Super-admin "View as school". We swap the live Supabase session to the
 * school's login (via a single-use magic link) and back up the super admin's
 * own refresh token in an httpOnly cookie so they can return with one click —
 * their super-admin session is preserved, not logged out.
 */
export const IMPERSONATION_BACKUP_COOKIE = "sa_impersonation";
export const IMPERSONATION_SCHOOL_COOKIE = "impersonating_school";

export interface Impersonation {
  schoolId: string;
  schoolName: string;
}

/** The active impersonation (if the super-admin backup session exists), else null. */
export async function getImpersonation(): Promise<Impersonation | null> {
  const store = await cookies();
  // We're only impersonating if the super admin's backup session is present.
  if (!store.get(IMPERSONATION_BACKUP_COOKIE)) return null;
  const raw = store.get(IMPERSONATION_SCHOOL_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { id?: string; name?: string };
    if (!parsed.id) return null;
    return { schoolId: parsed.id, schoolName: parsed.name ?? "school" };
  } catch {
    return null;
  }
}
