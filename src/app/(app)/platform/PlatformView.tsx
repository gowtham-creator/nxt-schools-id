"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { Building2, Loader2, Search, UserRoundPlus } from "lucide-react";
import { onboardSchool, setSchoolAccess } from "./actions";

/** Platform-wide headline numbers computed by the server component. */
export interface PlatformTotals {
  schools: number;
  students: number;
  staff: number;
  cardsGenerated: number;
  cardsPrinted: number;
}

/** One tenant school with its aggregated stats (serializable). */
export interface PlatformSchool {
  id: string;
  name: string;
  shortName: string | null;
  logoUrl: string | null;
  phone: string | null;
  createdAt: string;
  students: number;
  staff: number;
  generated: number;
  printed: number;
  users: number;
  weekActivity: number;
  templatesReady: boolean;
  /** All the tenant's non-super-admin logins are banned in auth. */
  suspended: boolean;
}

export interface PlatformData {
  totals: PlatformTotals;
  perSchool: PlatformSchool[];
}

type StatusFilter = "all" | "active" | "suspended";

// Fixed locales keep server and client render identical (no hydration drift).
const JOINED = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const NUM = new Intl.NumberFormat("en-US");

export default function PlatformView({
  data,
  ok,
  error,
}: {
  data: PlatformData;
  ok?: string;
  error?: string;
}) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [onboardOpen, setOnboardOpen] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  const activeCount = data.perSchool.filter((s) => !s.suspended).length;
  const suspendedCount = data.perSchool.length - activeCount;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.perSchool.filter((s) => {
      if (status === "active" && s.suspended) return false;
      if (status === "suspended" && !s.suspended) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        (s.shortName ?? "").toLowerCase().includes(q)
      );
    });
  }, [data.perSchool, query, status]);

  const setAccess = (id: string, suspend: boolean) => {
    setConfirmId(null);
    setPendingId(id);
    startTransition(async () => {
      const r = await setSchoolAccess(id, suspend);
      setNote(
        r.ok
          ? suspend
            ? "School suspended."
            : "School reactivated."
          : r.error ?? "Action failed.",
      );
      setPendingId(null);
      router.refresh();
    });
  };

  const summary = [
    { label: "Schools", value: data.totals.schools },
    { label: "Students", value: data.totals.students },
    { label: "Staff", value: data.totals.staff },
    { label: "Cards generated", value: data.totals.cardsGenerated },
    { label: "Cards printed", value: data.totals.cardsPrinted },
  ];

  const tabs: { k: StatusFilter; label: string; count: number }[] = [
    { k: "all", label: "All", count: data.perSchool.length },
    { k: "active", label: "Active", count: activeCount },
    { k: "suspended", label: "Suspended", count: suspendedCount },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Platform console</h1>
          <p className="mt-1 text-sm text-slate-500">
            Every school on NXT School ID, and their access.
          </p>
        </div>
        <button onClick={() => setOnboardOpen((v) => !v)} className="btn-primary">
          <UserRoundPlus className="h-4 w-4" />
          Onboard school
        </button>
      </div>

      {ok && (
        <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{ok}</p>
      )}
      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {/* Summary rail */}
      <div className="card mt-5 flex flex-wrap divide-y divide-slate-100 sm:divide-x sm:divide-y-0">
        {summary.map((s) => (
          <div key={s.label} className="min-w-[8rem] flex-1 px-5 py-4">
            <div className="text-2xl font-semibold tabular-nums text-slate-900">
              {NUM.format(s.value)}
            </div>
            <div className="mt-0.5 text-xs font-medium uppercase tracking-wide text-slate-400">
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* Onboard panel (on demand) */}
      {onboardOpen && (
        <motion.div
          initial={reduce ? false : { opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="card mt-4 p-6"
        >
          <h2 className="text-sm font-semibold text-slate-900">Onboard a school</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Creates the tenant, a school-admin login, the current academic year, and the six
            standard templates with defaults.
          </p>
          <form
            action={onboardSchool}
            className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            <div>
              <label htmlFor="onboard-name" className="field-label">
                School name *
              </label>
              <input id="onboard-name" name="name" required className="field-input" placeholder="Sunrise Public School" />
            </div>
            <div>
              <label htmlFor="onboard-email" className="field-label">
                Admin email *
              </label>
              <input id="onboard-email" name="email" type="email" required className="field-input" placeholder="admin@school.edu" />
            </div>
            <div>
              <label htmlFor="onboard-password" className="field-label">
                Temp password *
              </label>
              <input id="onboard-password" name="password" type="password" required minLength={8} className="field-input" placeholder="Min 8 characters" />
            </div>
            <div>
              <label htmlFor="onboard-address" className="field-label">
                Address
              </label>
              <input id="onboard-address" name="address" className="field-input" placeholder="Street, city" />
            </div>
            <div>
              <label htmlFor="onboard-phone" className="field-label">
                Phone
              </label>
              <input id="onboard-phone" name="phone" type="tel" className="field-input" placeholder="+91 98765 43210" />
            </div>
            <div className="flex items-end gap-2">
              <button type="submit" className="btn-primary">
                <UserRoundPlus className="h-4 w-4" />
                Create school
              </button>
              <button type="button" onClick={() => setOnboardOpen(false)} className="btn-secondary">
                Cancel
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {/* Toolbar */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search schools"
            className="field-input w-64 pl-9"
          />
        </div>
        <div className="flex rounded-lg border border-slate-200 bg-white p-1">
          {tabs.map((t) => (
            <button
              key={t.k}
              type="button"
              onClick={() => setStatus(t.k)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                status === t.k
                  ? "bg-teal-700 text-white"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {t.label}{" "}
              <span className={status === t.k ? "text-teal-100" : "text-slate-400"}>
                {t.count}
              </span>
            </button>
          ))}
        </div>
        {(pending || note) && (
          <span className="text-xs text-slate-500">{pending ? "Working…" : note}</span>
        )}
      </div>

      {/* Tenant table */}
      <div className="card mt-3 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">School</th>
                <th className="px-4 py-3 font-medium">Templates</th>
                <th className="px-4 py-3 text-right font-medium">Students</th>
                <th className="px-4 py-3 text-right font-medium">Staff</th>
                <th className="px-4 py-3 text-right font-medium">Cards</th>
                <th className="px-4 py-3 text-right font-medium">Users</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Access</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                    No schools match this view.
                  </td>
                </tr>
              )}
              {filtered.map((s) => {
                const busy = pendingId === s.id;
                const dim = s.suspended ? "text-slate-400" : "text-slate-700";
                return (
                  <tr
                    key={s.id}
                    className={`transition-colors ${
                      s.suspended ? "bg-slate-50/70" : "hover:bg-slate-50"
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {s.logoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={s.logoUrl}
                            alt=""
                            className={`h-8 w-8 shrink-0 rounded-md object-contain ${
                              s.suspended ? "opacity-50 grayscale" : ""
                            }`}
                          />
                        ) : (
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-400">
                            <Building2 className="h-4 w-4" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div
                            className={`truncate font-medium ${
                              s.suspended ? "text-slate-500" : "text-slate-900"
                            }`}
                          >
                            {s.name}
                          </div>
                          <div className="truncate text-xs text-slate-400">
                            {s.shortName ?? "—"} · joined {JOINED.format(new Date(s.createdAt))}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {s.templatesReady ? (
                        <span className="badge bg-teal-50 text-teal-700">Ready</span>
                      ) : (
                        <span className="badge bg-amber-50 text-amber-700">None</span>
                      )}
                    </td>
                    <td className={`px-4 py-3 text-right tabular-nums ${dim}`}>{s.students}</td>
                    <td className={`px-4 py-3 text-right tabular-nums ${dim}`}>{s.staff}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <span className={dim}>{s.generated}</span>
                      <span className="text-slate-300"> / </span>
                      <span className="text-slate-400">{s.printed}</span>
                    </td>
                    <td className={`px-4 py-3 text-right tabular-nums ${dim}`}>{s.users}</td>
                    <td className="px-4 py-3">
                      {s.suspended ? (
                        <span className="badge bg-rose-50 text-rose-700">Suspended</span>
                      ) : (
                        <span className="badge bg-emerald-50 text-emerald-700">Active</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      {busy ? (
                        <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Working
                        </span>
                      ) : s.suspended ? (
                        <button
                          type="button"
                          onClick={() => setAccess(s.id, false)}
                          className="cursor-pointer text-sm font-medium text-teal-700 hover:text-teal-800"
                        >
                          Reactivate
                        </button>
                      ) : confirmId === s.id ? (
                        <span className="inline-flex items-center gap-2">
                          <span className="text-xs text-slate-500">Suspend?</span>
                          <button
                            type="button"
                            onClick={() => setAccess(s.id, true)}
                            className="cursor-pointer text-sm font-medium text-rose-600 hover:text-rose-700"
                          >
                            Confirm
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmId(null)}
                            className="cursor-pointer text-sm text-slate-500 hover:text-slate-700"
                          >
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmId(s.id)}
                          className="cursor-pointer text-sm font-medium text-slate-500 hover:text-rose-600"
                        >
                          Suspend
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-2 text-xs text-slate-400">
        Suspending blocks a school&rsquo;s logins immediately; any active session ends within the
        hour. Reactivate to restore access.
      </p>
    </div>
  );
}
