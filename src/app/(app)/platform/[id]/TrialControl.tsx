"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Timer } from "lucide-react";
import type { TrialConfig } from "@/lib/trial";
import { assignTrial, extendTrial, resetTrial, disableTrial } from "../trial-admin-actions";

/** Seconds → "4h 0m". */
function human(total: number): string {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  return `${h}h ${m}m`;
}

/**
 * Super-admin control for a school's time-limited access. Assign a budget of
 * active login time, extend it, reset consumed time, or lift the limit entirely
 * (e.g. once they pay). When the budget is spent the school is locked out.
 */
export default function TrialControl({
  schoolId,
  config,
}: {
  schoolId: string;
  config: TrialConfig | null;
}) {
  const router = useRouter();
  const [hours, setHours] = useState("4");
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  const active = !!config?.enabled;

  const run = (fn: () => Promise<void>, msg: string) => {
    setNote("");
    startTransition(async () => {
      try {
        await fn();
        setNote(msg);
        router.refresh();
      } catch {
        setNote("Something went wrong.");
      }
    });
  };

  const hoursNum = () => {
    const n = Number(hours);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };

  const pct =
    config && config.limit > 0
      ? Math.max(0, Math.min(100, (config.remaining / config.limit) * 100))
      : 0;

  return (
    <div className="card p-6">
      <div className="flex items-center gap-2">
        <Timer className="h-4 w-4 text-slate-400" />
        <h2 className="text-sm font-semibold text-slate-900">Time-limited access</h2>
        {active ? (
          config!.expired ? (
            <span className="badge bg-rose-50 text-rose-700">Locked out</span>
          ) : (
            <span className="badge bg-emerald-50 text-emerald-700">Enforced</span>
          )
        ) : (
          <span className="badge bg-slate-100 text-slate-500">Off</span>
        )}
      </div>
      <p className="mt-1 text-xs text-slate-500">
        Give this school a budget of active login time. When it runs out the app locks,
        signs them out, and blocks sign-in until you extend, reset, or lift the limit.
      </p>

      {active && config && (
        <div className="mt-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
            <span className="text-slate-500">
              Used <span className="font-medium text-slate-800">{human(config.used)}</span> of{" "}
              <span className="font-medium text-slate-800">{human(config.limit)}</span>
            </span>
            <span className={config.expired ? "font-semibold text-rose-600" : "font-semibold text-emerald-600"}>
              {config.expired ? "Time used up" : `${human(config.remaining)} left`}
            </span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full ${config.expired ? "bg-rose-500" : "bg-emerald-500"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="trial-hours" className="field-label">
            Hours
          </label>
          <input
            id="trial-hours"
            type="number"
            min={1}
            step={1}
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            className="field-input w-24"
          />
        </div>

        {!active ? (
          <button
            type="button"
            disabled={pending || hoursNum() <= 0}
            onClick={() => run(() => assignTrial(schoolId, hoursNum()), "Time limit enforced.")}
            className="btn-primary btn-sm"
          >
            Enforce time limit
          </button>
        ) : (
          <>
            <button
              type="button"
              disabled={pending || hoursNum() <= 0}
              onClick={() => run(() => assignTrial(schoolId, hoursNum()), "Limit updated.")}
              className="btn-secondary btn-sm"
            >
              Set limit
            </button>
            <button
              type="button"
              disabled={pending || hoursNum() <= 0}
              onClick={() => run(() => extendTrial(schoolId, hoursNum()), "Time added.")}
              className="btn-secondary btn-sm"
            >
              + Add hours
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => resetTrial(schoolId), "Timer reset.")}
              className="btn-secondary btn-sm"
            >
              Reset timer
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => disableTrial(schoolId), "Full access granted.")}
              className="btn-sm cursor-pointer text-sm font-medium text-teal-700 hover:text-teal-800"
            >
              Lift limit (grant access)
            </button>
          </>
        )}

        {(pending || note) && (
          <span className="text-xs text-slate-500">{pending ? "Working…" : note}</span>
        )}
      </div>
    </div>
  );
}
