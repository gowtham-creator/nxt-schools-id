"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";
import {
  Activity,
  Building2,
  CalendarDays,
  GraduationCap,
  IdCard,
  Phone,
  Printer,
  School,
  UserRoundPlus,
  type LucideIcon,
} from "lucide-react";
import { onboardSchool } from "./actions";

/** Platform-wide headline numbers computed by the server component. */
export interface PlatformTotals {
  schools: number;
  students: number;
  staff: number;
  /** Members whose pipeline is generated..printed. */
  cardsGenerated: number;
  /** Members whose pipeline is printed. */
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
  /** card.generated audit events in the last 7 days. */
  weekActivity: number;
  /** Both school-wide default template ids are set. */
  templatesReady: boolean;
}

export interface PlatformData {
  totals: PlatformTotals;
  perSchool: PlatformSchool[];
}

interface Hero {
  label: string;
  display: string;
  icon: LucideIcon;
}

/** Deterministic on server and client — avoids hydration mismatches. */
const JOINED = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export default function PlatformView({
  data,
  ok,
  error,
}: {
  data: PlatformData;
  ok?: string;
  error?: string;
}) {
  const reduce = useReducedMotion();

  const heroes: Hero[] = [
    { label: "Schools", display: String(data.totals.schools), icon: School },
    {
      label: "Students",
      display: String(data.totals.students),
      icon: GraduationCap,
    },
    {
      label: "Cards generated",
      display: String(data.totals.cardsGenerated),
      icon: IdCard,
    },
    {
      label: "Cards printed",
      display: String(data.totals.cardsPrinted),
      icon: Printer,
    },
  ];

  const container: Variants = {
    hidden: {},
    show: {
      transition: {
        staggerChildren: reduce ? 0 : 0.07,
        delayChildren: reduce ? 0 : 0.04,
      },
    },
  };

  const item: Variants = {
    hidden: reduce ? { opacity: 0 } : { opacity: 0, y: 16 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.4, ease: "easeOut" },
    },
  };

  return (
    <motion.div variants={container} initial="hidden" animate="show">
      {/* Heading */}
      <motion.div variants={item}>
        <h1 className="text-2xl font-semibold text-slate-900">
          Platform console
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Every school on NXT School ID, at a glance.
        </p>
      </motion.div>

      {/* Onboarding result banners */}
      {ok && (
        <motion.p
          variants={item}
          className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
        >
          {ok}
        </motion.p>
      )}
      {error && (
        <motion.p
          variants={item}
          className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </motion.p>
      )}

      {/* Hero stat tiles */}
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {heroes.map((h) => (
          <motion.div
            key={h.label}
            variants={item}
            className="card flex items-center gap-4 p-6"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
              <h.icon className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <div className="text-3xl font-bold leading-none text-slate-900">
                {h.display}
              </div>
              <div className="mt-1.5 text-sm font-medium text-slate-500">
                {h.label}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Onboard a school */}
      <motion.div variants={item} className="card mt-6 p-6">
        <h2 className="text-sm font-semibold text-slate-900">
          Onboard a school
        </h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Spin up a brand-new tenant in one step.
        </p>
        <form
          action={onboardSchool}
          className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          <div>
            <label htmlFor="onboard-name" className="field-label">
              School name *
            </label>
            <input
              id="onboard-name"
              name="name"
              required
              className="field-input"
              placeholder="Sunrise Public School"
            />
          </div>
          <div>
            <label htmlFor="onboard-email" className="field-label">
              Admin email *
            </label>
            <input
              id="onboard-email"
              name="email"
              type="email"
              required
              className="field-input"
              placeholder="admin@school.edu"
            />
          </div>
          <div>
            <label htmlFor="onboard-password" className="field-label">
              Temp password *
            </label>
            <input
              id="onboard-password"
              name="password"
              type="password"
              required
              minLength={8}
              className="field-input"
              placeholder="Min 8 characters"
            />
          </div>
          <div>
            <label htmlFor="onboard-address" className="field-label">
              Address
            </label>
            <input
              id="onboard-address"
              name="address"
              className="field-input"
              placeholder="Street, city"
            />
          </div>
          <div>
            <label htmlFor="onboard-phone" className="field-label">
              Phone
            </label>
            <input
              id="onboard-phone"
              name="phone"
              type="tel"
              className="field-input"
              placeholder="+91 98765 43210"
            />
          </div>
          <div className="flex items-end">
            <button type="submit" className="btn-primary">
              <UserRoundPlus className="h-4 w-4" />
              Create school
            </button>
          </div>
        </form>
        <p className="mt-3 text-xs text-slate-500">
          Creates the tenant, a school admin login, the current academic year,
          and copies the six standard templates with defaults.
        </p>
      </motion.div>

      {/* Per-school grid */}
      <motion.h2
        variants={item}
        className="mt-8 text-sm font-medium text-slate-500"
      >
        Schools ({data.perSchool.length})
      </motion.h2>

      {data.perSchool.length === 0 ? (
        <motion.div
          variants={item}
          className="card mt-3 p-10 text-center text-sm text-slate-400"
        >
          No schools yet — onboard the first one above.
        </motion.div>
      ) : (
        <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {data.perSchool.map((s) => {
            const stats: { label: string; value: number }[] = [
              { label: "Students", value: s.students },
              { label: "Staff", value: s.staff },
              { label: "Generated", value: s.generated },
              { label: "Printed", value: s.printed },
              { label: "Users", value: s.users },
            ];
            return (
              <motion.div key={s.id} variants={item} className="card p-6">
                <div className="flex items-start gap-4">
                  {s.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={s.logoUrl}
                      alt={`${s.name} logo`}
                      className="h-10 w-auto shrink-0"
                    />
                  ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                      <Building2 className="h-5 w-5" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-sm font-semibold text-slate-900">
                        {s.name}
                      </h3>
                      {s.shortName && (
                        <span className="badge bg-slate-100 text-slate-600">
                          {s.shortName}
                        </span>
                      )}
                      {s.templatesReady ? (
                        <span className="badge bg-teal-50 text-teal-700">
                          Templates ready ✓
                        </span>
                      ) : (
                        <span className="badge bg-amber-50 text-amber-700">
                          No templates
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <Phone className="h-3.5 w-3.5 text-slate-400" />
                        {s.phone ?? "No phone"}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
                        Joined {JOINED.format(new Date(s.createdAt))}
                      </span>
                    </div>
                  </div>
                </div>

                <dl className="mt-4 grid grid-cols-5 gap-2 border-t border-slate-100 pt-4 text-center">
                  {stats.map((st) => (
                    <div key={st.label}>
                      <dd className="text-lg font-semibold text-slate-900">
                        {st.value}
                      </dd>
                      <dt className="mt-0.5 text-[11px] font-medium text-slate-500">
                        {st.label}
                      </dt>
                    </div>
                  ))}
                </dl>

                <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-slate-500">
                  <Activity className="h-3.5 w-3.5 text-teal-600" />
                  Activity this week:{" "}
                  <span className="font-semibold text-slate-700">
                    {s.weekActivity}
                  </span>{" "}
                  card{s.weekActivity === 1 ? "" : "s"}
                </p>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
