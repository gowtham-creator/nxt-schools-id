"use server";

import { getProfile } from "@/lib/auth";
import { getImpersonation } from "@/lib/impersonation";
import { recordTrialTick, getTrialStatus, type TrialStatus } from "@/lib/trial";

/**
 * Heartbeat from the dashboard TrialTimer. Advances the school's active-usage
 * clock and returns the fresh status (or null when the school has no trial).
 * While a super admin is "viewing as" the school, the timer is shown but NOT
 * advanced — debugging shouldn't consume the school's time.
 */
export async function tickTrial(): Promise<TrialStatus | null> {
  const { profile } = await getProfile();
  if (!profile.school_id) return null;
  if (await getImpersonation()) return getTrialStatus(profile.school_id);
  return recordTrialTick(profile.school_id);
}
