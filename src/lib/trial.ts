import "server-only";

import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Super-admin-managed, usage-based access limits (a paywall lever for schools
 * that haven't paid). A school gets a budget of ACTIVE login time; the clock
 * advances only while someone is actually using the app (heartbeats) and pauses
 * when they close/leave, so idle/closed gaps aren't counted. When the budget is
 * spent the app locks (see the /restricted screen + layout gate + login block).
 *
 * Fully DB-driven: which schools are limited, their budget, and the consumed
 * time all live in the `trial_usage` table (managed from the Platform console).
 * A school with no row — or a row with enabled = false — has no limit.
 * See supabase/migrations/0004_trial_usage.sql + 0005_trial_usage_config.sql.
 */
export const TRIAL_HEARTBEAT_SECONDS = 20;
/** A gap bigger than this means the tab was closed/idle — not counted. */
const MAX_GAP_SECONDS = TRIAL_HEARTBEAT_SECONDS * 3;

interface TrialRow {
  seconds_limit: number;
  seconds_used: number;
  enabled: boolean;
}

export interface TrialStatus {
  limit: number;
  used: number;
  remaining: number;
  expired: boolean;
}
/** Admin view of a school's limit (may be disabled). */
export interface TrialConfig extends TrialStatus {
  enabled: boolean;
}

async function readRow(schoolId: string): Promise<TrialRow | null> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("trial_usage")
      .select("seconds_limit, seconds_used, enabled")
      .eq("school_id", schoolId)
      .maybeSingle<TrialRow>();
    return data ?? null;
  } catch {
    // Table/columns not present yet → treat as "no limit".
    return null;
  }
}

function statusOf(limit: number, used: number): TrialStatus {
  const u = Math.max(0, Math.min(limit, used));
  const remaining = Math.max(0, limit - u);
  return { limit, used: u, remaining, expired: remaining <= 0 };
}

/**
 * Enforcement/dashboard status. Returns null unless the school has an ENABLED
 * limit. Cached per request so the layout gate and dashboard share one read.
 */
export const getTrialStatus = cache(
  async (schoolId: string): Promise<TrialStatus | null> => {
    const row = await readRow(schoolId);
    if (!row || !row.enabled) return null;
    return statusOf(row.seconds_limit, row.seconds_used);
  },
);

/** Full config for the super-admin control (enabled or not). Null if no row. */
export async function getTrialConfig(schoolId: string): Promise<TrialConfig | null> {
  const row = await readRow(schoolId);
  if (!row) return null;
  return { ...statusOf(row.seconds_limit, row.seconds_used), enabled: row.enabled };
}

/**
 * Advance the active-usage clock atomically (DB-clock authoritative, idle gaps
 * capped) and return the new status. Null when the school has no active limit.
 */
export async function recordTrialTick(schoolId: string): Promise<TrialStatus | null> {
  const row = await readRow(schoolId);
  if (!row || !row.enabled) return null;
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("trial_tick", {
      p_school_id: schoolId,
      p_limit: row.seconds_limit,
      p_max_gap: MAX_GAP_SECONDS,
    });
    if (error) throw error;
    return statusOf(row.seconds_limit, Number(data ?? row.seconds_used));
  } catch {
    return statusOf(row.seconds_limit, row.seconds_used);
  }
}
