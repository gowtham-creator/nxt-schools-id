"use server";

import { getProfile } from "@/lib/auth";
import { recordTrialTick, type TrialStatus } from "@/lib/trial";

/**
 * Heartbeat from the dashboard TrialTimer. Advances the school's active-usage
 * clock and returns the fresh status (or null when the school has no trial).
 */
export async function tickTrial(): Promise<TrialStatus | null> {
  const { profile } = await getProfile();
  if (!profile.school_id) return null;
  return recordTrialTick(profile.school_id);
}
