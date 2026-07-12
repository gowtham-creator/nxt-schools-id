import "server-only";

import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Usage-based trial (like a game demo): a school gets a fixed budget of ACTIVE
 * login time. The clock advances only while someone is actually using the app
 * (heartbeats from the dashboard timer) and pauses when they close/leave, so a
 * gap larger than one heartbeat is never counted. Consumed time is stored in the
 * `trial_usage` table and advanced atomically by the `trial_tick` DB function
 * (see supabase/migrations/0004_trial_usage.sql); the browser never writes it.
 *
 * This constant is the source of truth for WHICH schools have a trial and their
 * limit — currently ONLY Tulips Concept School Siddipet. Any school not listed
 * here has no trial and incurs zero lookups.
 */
export const TRIAL_SCHOOLS: Record<string, number> = {
  // Tulips Concept School Siddipet — 4 hours of active usage.
  "217189b4-4c3a-4b97-8646-fa94e9eb78cc": 4 * 60 * 60,
};

/** Client heartbeat cadence (seconds). Kept in sync with TrialTimer. */
export const TRIAL_HEARTBEAT_SECONDS = 20;
/** A gap bigger than this means the tab was closed/idle — not counted. */
const MAX_GAP_SECONDS = TRIAL_HEARTBEAT_SECONDS * 3;

export interface TrialStatus {
  limit: number;
  used: number;
  remaining: number;
  expired: boolean;
}

/** The active-usage budget for a school, or null if it has no trial. */
export function trialLimitFor(schoolId: string | null | undefined): number | null {
  if (!schoolId) return null;
  return TRIAL_SCHOOLS[schoolId] ?? null;
}

function statusOf(limit: number, used: number): TrialStatus {
  const clamped = Math.max(0, Math.min(limit, used));
  const remaining = Math.max(0, limit - clamped);
  return { limit, used: clamped, remaining, expired: remaining <= 0 };
}

/**
 * Read-only trial status for a school (cached per request so the layout gate and
 * the dashboard share one query). Returns null when the school has no trial.
 */
export const getTrialStatus = cache(
  async (schoolId: string): Promise<TrialStatus | null> => {
    const limit = trialLimitFor(schoolId);
    if (limit == null) return null;
    let used = 0;
    try {
      const admin = createAdminClient();
      const { data } = await admin
        .from("trial_usage")
        .select("seconds_used")
        .eq("school_id", schoolId)
        .maybeSingle<{ seconds_used: number }>();
      used = Number(data?.seconds_used ?? 0);
    } catch {
      /* table missing / transient → treat as unused */
    }
    return statusOf(limit, used);
  },
);

/**
 * Advance the active-usage clock atomically (DB-clock authoritative, idle gaps
 * capped) and return the new status. Returns null when the school has no trial.
 */
export async function recordTrialTick(schoolId: string): Promise<TrialStatus | null> {
  const limit = trialLimitFor(schoolId);
  if (limit == null) return null;
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("trial_tick", {
      p_school_id: schoolId,
      p_limit: limit,
      p_max_gap: MAX_GAP_SECONDS,
    });
    if (error) throw error;
    return statusOf(limit, Number(data ?? 0));
  } catch {
    // Never break the app on a heartbeat failure — report the last-known status.
    return getTrialStatus(schoolId);
  }
}
