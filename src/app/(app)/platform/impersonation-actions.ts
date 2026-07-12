"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  IMPERSONATION_BACKUP_COOKIE,
  IMPERSONATION_SCHOOL_COOKIE,
} from "@/lib/impersonation";

const COOKIE_OPTS = {
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 8, // 8 hours
};

/**
 * Super admin enters a school's app in the SAME browser session. Their own
 * session's refresh token is backed up (httpOnly) so they can return without
 * re-logging-in; the live session is swapped to the school's login via a
 * single-use magic-link token (no email is sent).
 */
export async function startImpersonation(schoolId: string): Promise<void> {
  const me = await requireRole(["super_admin"]);
  const admin = createAdminClient();

  // A login to view as — prefer the school's admin, else any of its users.
  const { data: users } = await admin
    .from("app_users")
    .select("id, role")
    .eq("school_id", schoolId)
    .in("role", ["admin", "operator"]);
  const target =
    (users ?? []).find((u) => u.role === "admin") ?? (users ?? [])[0];
  const fail = (msg: string): never =>
    redirect(`/platform/${schoolId}?error=${encodeURIComponent(msg)}`);
  if (!target) fail("This school has no login to view as.");

  const { data: authUser } = await admin.auth.admin.getUserById(target!.id);
  const email = authUser.user?.email;
  if (!email) fail("Could not resolve the school login.");

  const { data: school } = await admin
    .from("schools")
    .select("name")
    .eq("id", schoolId)
    .maybeSingle<{ name: string }>();

  const supabase = await createClient();
  const cookieStore = await cookies();

  // 1) Back up the super admin's session so we can restore it on return.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.refresh_token) {
    cookieStore.set(IMPERSONATION_BACKUP_COOKIE, session.refresh_token, COOKIE_OPTS);
  }
  cookieStore.set(
    IMPERSONATION_SCHOOL_COOKIE,
    JSON.stringify({ id: schoolId, name: school?.name ?? "school", sa: me.id }),
    COOKIE_OPTS,
  );

  // 2) Swap the live session to the school login via a single-use magic link.
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: email!,
  });
  const tokenHash = link?.properties?.hashed_token;
  if (linkErr || !tokenHash) {
    cookieStore.delete(IMPERSONATION_BACKUP_COOKIE);
    cookieStore.delete(IMPERSONATION_SCHOOL_COOKIE);
    fail("Could not start view-as for this school.");
  }
  const { error: otpErr } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: tokenHash!,
  });
  if (otpErr) {
    cookieStore.delete(IMPERSONATION_BACKUP_COOKIE);
    cookieStore.delete(IMPERSONATION_SCHOOL_COOKIE);
    fail(otpErr.message);
  }

  redirect("/dashboard");
}

/** Return to the super-admin session (restores the backed-up session). */
export async function stopImpersonation(): Promise<void> {
  const cookieStore = await cookies();
  const backup = cookieStore.get(IMPERSONATION_BACKUP_COOKIE)?.value;
  if (backup) {
    const supabase = await createClient();
    await supabase.auth.refreshSession({ refresh_token: backup });
  }
  cookieStore.delete(IMPERSONATION_BACKUP_COOKIE);
  cookieStore.delete(IMPERSONATION_SCHOOL_COOKIE);
  redirect("/platform");
}
