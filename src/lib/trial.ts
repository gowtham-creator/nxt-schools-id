import "server-only";

import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Usage-based trial (like a game demo): a school gets a fixed budget of ACTIVE
 * login time. The clock advances only while someone is actually using the app
 * (heartbeats from the dashboard timer) and pauses when they close/leave, so a
 * gap larger than one heartbeat is never counted. Persisted per school in the
 * private `trial` storage bucket (written only by the service-role admin
 * client, never by the browser).
 *
 * Scoped by school id — currently ONLY Tulips Concept School Siddipet. Any
 * school not listed here has no trial and zero overhead.
 */
export const TRIAL_SCHOOLS: Record<string, number> = {
  // Tulips Concept School Siddipet — 4 hours of active usage.
  "217189b4-4c3a-4b97-8646-fa94e9eb78cc": 4 * 60 * 60,
};

const BUCKET = "trial";
/** Client heartbeat cadence (seconds). Kept in sync with TrialTimer. */
export const TRIAL_HEARTBEAT_SECONDS = 20;
/** A gap bigger than this means the tab was closed/idle — not counted. */
const MAX_GAP_SECONDS = TRIAL_HEARTBEAT_SECONDS * 3;

interface TrialState {
  secondsLimit: number;
  secondsUsed: number;
  startedAt: string | null;
  lastTick: string | null;
}

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

function statusOf(state: TrialState): TrialStatus {
  const remaining = Math.max(0, state.secondsLimit - state.secondsUsed);
  return { limit: state.secondsLimit, used: state.secondsUsed, remaining, expired: remaining <= 0 };
}

async function readState(schoolId: string, limit: number): Promise<TrialState> {
  try {
    const admin = createAdminClient();
    const { data } = await admin.storage.from(BUCKET).download(`${schoolId}.json`);
    if (data) {
      const parsed = JSON.parse(await data.text()) as Partial<TrialState>;
      return {
        secondsLimit: limit, // the constant is the source of truth for the limit
        secondsUsed: Math.max(0, Math.min(limit, Number(parsed.secondsUsed) || 0)),
        startedAt: typeof parsed.startedAt === "string" ? parsed.startedAt : null,
        lastTick: typeof parsed.lastTick === "string" ? parsed.lastTick : null,
      };
    }
  } catch {
    /* no state yet → start fresh */
  }
  return { secondsLimit: limit, secondsUsed: 0, startedAt: null, lastTick: null };
}

async function writeState(schoolId: string, state: TrialState): Promise<void> {
  const admin = createAdminClient();
  const body = new Blob([JSON.stringify(state)], { type: "application/json" });
  await admin.storage
    .from(BUCKET)
    .upload(`${schoolId}.json`, body, { upsert: true, contentType: "application/json" });
}

/**
 * Read-only trial status for a school (cached per request so the layout gate and
 * the dashboard share one storage read). Returns null when the school has no trial.
 */
export const getTrialStatus = cache(
  async (schoolId: string): Promise<TrialStatus | null> => {
    const limit = trialLimitFor(schoolId);
    if (limit == null) return null;
    return statusOf(await readState(schoolId, limit));
  },
);

/**
 * Advance the active-usage clock by the real time elapsed since the last
 * heartbeat (capped so idle/closed gaps don't count), persist it, and return the
 * new status. Returns null when the school has no trial.
 */
export async function recordTrialTick(schoolId: string): Promise<TrialStatus | null> {
  const limit = trialLimitFor(schoolId);
  if (limit == null) return null;

  const state = await readState(schoolId, limit);
  const nowMs = Date.now();
  const now = new Date(nowMs).toISOString();

  if (!state.startedAt) state.startedAt = now;
  if (state.lastTick) {
    const gapSeconds = (nowMs - new Date(state.lastTick).getTime()) / 1000;
    if (gapSeconds > 0 && gapSeconds <= MAX_GAP_SECONDS) {
      state.secondsUsed = Math.min(limit, state.secondsUsed + gapSeconds);
    }
  }
  state.lastTick = now;
  await writeState(schoolId, state);
  return statusOf(state);
}
