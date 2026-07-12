"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";

const nowIso = () => new Date().toISOString();
const toSeconds = (hours: number) => Math.max(1, Math.round(hours * 3600));

async function audit(schoolId: string, actorId: string, meta: Record<string, unknown>) {
  const admin = createAdminClient();
  await logAudit(admin, {
    schoolId,
    actorId,
    action: "school.trial_updated",
    targetType: "school",
    targetId: schoolId,
    meta,
  });
}

/** Assign / set a time limit (hours) for a school and turn enforcement on. */
export async function assignTrial(schoolId: string, hours: number): Promise<void> {
  const me = await requireRole(["super_admin"]);
  const admin = createAdminClient();
  const seconds = toSeconds(hours);
  const { data: existing } = await admin
    .from("trial_usage")
    .select("school_id")
    .eq("school_id", schoolId)
    .maybeSingle<{ school_id: string }>();
  if (existing) {
    await admin
      .from("trial_usage")
      .update({ seconds_limit: seconds, enabled: true, updated_at: nowIso() })
      .eq("school_id", schoolId);
  } else {
    await admin
      .from("trial_usage")
      .insert({ school_id: schoolId, seconds_limit: seconds, seconds_used: 0, enabled: true });
  }
  await audit(schoolId, me.id, { action: "assign", hours });
  revalidatePath(`/platform/${schoolId}`);
}

/** Add more time (hours) to a school's budget. */
export async function extendTrial(schoolId: string, hours: number): Promise<void> {
  const me = await requireRole(["super_admin"]);
  const admin = createAdminClient();
  const { data } = await admin
    .from("trial_usage")
    .select("seconds_limit")
    .eq("school_id", schoolId)
    .maybeSingle<{ seconds_limit: number }>();
  const base = data?.seconds_limit ?? 0;
  await admin
    .from("trial_usage")
    .update({ seconds_limit: base + toSeconds(hours), enabled: true, updated_at: nowIso() })
    .eq("school_id", schoolId);
  await audit(schoolId, me.id, { action: "extend", hours });
  revalidatePath(`/platform/${schoolId}`);
}

/** Reset consumed time to zero (restarts the budget), keeping enforcement on. */
export async function resetTrial(schoolId: string): Promise<void> {
  const me = await requireRole(["super_admin"]);
  const admin = createAdminClient();
  await admin
    .from("trial_usage")
    .update({ seconds_used: 0, started_at: null, last_tick: null, enabled: true, updated_at: nowIso() })
    .eq("school_id", schoolId);
  await audit(schoolId, me.id, { action: "reset" });
  revalidatePath(`/platform/${schoolId}`);
}

/** Lift the limit — the school gets full, unrestricted access (e.g. after payment). */
export async function disableTrial(schoolId: string): Promise<void> {
  const me = await requireRole(["super_admin"]);
  const admin = createAdminClient();
  await admin
    .from("trial_usage")
    .update({ enabled: false, updated_at: nowIso() })
    .eq("school_id", schoolId);
  await audit(schoolId, me.id, { action: "disable" });
  revalidatePath(`/platform/${schoolId}`);
}
