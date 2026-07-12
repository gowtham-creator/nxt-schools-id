"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock } from "lucide-react";
import { tickTrial } from "./trial-actions";

/** Seconds → HH:MM:SS. */
function fmt(total: number): string {
  const s = Math.max(0, Math.floor(total));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((n) => String(n).padStart(2, "0")).join(":");
}

/**
 * Live trial countdown for a usage-based trial school. Shows the remaining
 * ACTIVE time (HH:MM:SS), counts down every second while the tab is visible,
 * and every 20s sends a heartbeat that persists the elapsed active time on the
 * server and re-syncs the display to the server truth. When it runs out, the
 * school is sent to /restricted.
 */
export default function TrialTimer({
  initialRemaining,
  limit,
}: {
  initialRemaining: number;
  limit: number;
}) {
  const router = useRouter();
  const [remaining, setRemaining] = useState(initialRemaining);

  // Smooth per-second countdown (predicted; corrected by each heartbeat).
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") {
        setRemaining((r) => Math.max(0, r - 1));
      }
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Heartbeat: persist real active time + re-sync remaining with the server.
  useEffect(() => {
    let alive = true;
    const beat = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const status = await tickTrial();
        if (!alive || !status) return;
        setRemaining(status.remaining);
        if (status.expired) router.replace("/restricted");
      } catch {
        /* transient — the next heartbeat retries */
      }
    };
    const id = setInterval(beat, 20_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [router]);

  // When the predicted countdown reaches zero, confirm with the server, then lock.
  useEffect(() => {
    if (remaining > 0) return;
    let alive = true;
    tickTrial().then((s) => {
      if (alive && (!s || s.expired)) router.replace("/restricted");
    });
    return () => {
      alive = false;
    };
  }, [remaining, router]);

  const low = remaining <= 15 * 60; // last 15 minutes
  const pct = limit > 0 ? Math.max(0, Math.min(100, (remaining / limit) * 100)) : 0;

  return (
    <div
      className={`card mb-6 flex flex-wrap items-center gap-4 border p-4 ${
        low ? "border-rose-200 bg-rose-50" : "border-teal-200 bg-teal-50/70"
      }`}
    >
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
          low ? "bg-rose-100 text-rose-700" : "bg-teal-100 text-teal-700"
        }`}
      >
        <Clock className="h-5 w-5" />
      </div>
      <div>
        <div
          className={`text-xs font-semibold uppercase tracking-wide ${
            low ? "text-rose-600" : "text-teal-700"
          }`}
        >
          Trial time left
        </div>
        <div
          className={`font-mono text-2xl font-bold tabular-nums ${
            low ? "text-rose-700" : "text-teal-800"
          }`}
        >
          {fmt(remaining)}
        </div>
      </div>
      <div className="ml-auto w-40 max-w-[45%]">
        <div className="h-2 w-full overflow-hidden rounded-full bg-white/70">
          <div
            className={`h-full rounded-full ${low ? "bg-rose-500" : "bg-teal-600"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-1 text-right text-[11px] text-slate-500">
          of {fmt(limit)} trial
        </div>
      </div>
    </div>
  );
}
