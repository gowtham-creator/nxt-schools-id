"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { PLATFORM_OWNER_ID } from "@/lib/platform-owner";

type Result = { ok: boolean; error: string | null };

/**
 * Only the protected platform owner may manage super admins. Returns the owner
 * profile, or an error result the caller surfaces (never throws for the
 * expected "not owner" / "owner is protected" cases).
 */
async function ownerOnly(): Promise<
  { me: { id: string; school_id: string | null } } | { error: string }
> {
  const me = await requireRole(["super_admin"]);
  if (me.id !== PLATFORM_OWNER_ID) {
    return { error: "Only the platform owner can manage super admins." };
  }
  return { me: { id: me.id, school_id: me.school_id } };
}

/**
 * Suspend (ban) or reactivate another super admin's login. Owner-only. The
 * owner account is never a valid target.
 */
export async function setSuperAdminAccess(
  userId: string,
  suspend: boolean,
): Promise<Result> {
  const gate = await ownerOnly();
  if ("error" in gate) return { ok: false, error: gate.error };
  if (userId === PLATFORM_OWNER_ID) {
    return { ok: false, error: "The owner account is protected." };
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: suspend ? "876000h" : "none",
  });
  if (error) return { ok: false, error: error.message };

  await logAudit(admin, {
    schoolId: gate.me.school_id,
    actorId: gate.me.id,
    action: suspend ? "superadmin.suspended" : "superadmin.reactivated",
    targetType: "user",
    targetId: userId,
  });
  revalidatePath("/platform/admins");
  return { ok: true, error: null };
}

/**
 * Permanently remove another super admin (deletes their login + profile).
 * Owner-only. The owner account is never a valid target.
 */
export async function removeSuperAdmin(userId: string): Promise<Result> {
  const gate = await ownerOnly();
  if ("error" in gate) return { ok: false, error: gate.error };
  if (userId === PLATFORM_OWNER_ID) {
    return { ok: false, error: "The owner account is protected." };
  }

  const admin = createAdminClient();
  // Only ever remove a super-admin profile here (never a school user).
  await admin.from("app_users").delete().eq("id", userId).eq("role", "super_admin");
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { ok: false, error: error.message };

  await logAudit(admin, {
    schoolId: gate.me.school_id,
    actorId: gate.me.id,
    action: "superadmin.removed",
    targetType: "user",
    targetId: userId,
  });
  revalidatePath("/platform/admins");
  return { ok: true, error: null };
}
