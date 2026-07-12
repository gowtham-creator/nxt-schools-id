"use server";

import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";

/**
 * Reset a school user's password to a fresh temporary one and return it (shown
 * once in the console). Passwords are stored hashed and can't be read back, so
 * this is how a super admin obtains working credentials for a school.
 */
export async function resetSchoolLoginPassword(
  userId: string,
  schoolId: string,
): Promise<{ password: string | null; error: string | null }> {
  const me = await requireRole(["super_admin"]);
  const admin = createAdminClient();

  const password = `Nxt-${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
  const { data, error } = await admin.auth.admin.updateUserById(userId, {
    password,
    ban_duration: "none", // clear any ban so the new password works immediately
  });
  if (error || !data.user) return { password: null, error: error?.message ?? "Reset failed" };

  await logAudit(admin, {
    schoolId,
    actorId: me.id,
    action: "user.role_changed",
    targetType: "user",
    targetId: userId,
    meta: { action: "password_reset", email: data.user.email },
  });

  return { password, error: null };
}
