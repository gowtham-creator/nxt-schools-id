"use client";

import { Fragment } from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import {
  Building2,
  Users,
  UserCog,
  Camera,
  Check,
  ImageUp,
  IdCard,
  LayoutTemplate,
  Send,
  Settings,
  Printer,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { ScanLine } from "lucide-react";
import type { AnalyticsData } from "@/lib/analytics";
import type { TrialStatus } from "@/lib/trial";
import StatusDonut from "./charts/StatusDonut";
import GeneratedAreaChart from "./charts/GeneratedAreaChart";
import BranchBarChart from "./charts/BranchBarChart";
import ClassBarChart from "./charts/ClassBarChart";
import AutoRefresh from "../AutoRefresh";
import TrialTimer from "../TrialTimer";

/** Serializable metrics computed by the server component. */
export interface DashboardMetrics {
  /** Total number of branches. */
  branches: number;
  /** Total number of students (members) — headline count. */
  students: number;
  /** Denominator for every funnel stage (equals total students). */
  total: number;
  /** Members with a photo uploaded. */
  imageUploaded: number;
  /** Members whose ID has been generated (generation onward). */
  idGenerated: number;
  /** Members sent for printing (sent + printed). */
  sentForPrinting: number;
  /** Members already printed. */
  printed: number;
}

/** Serializable onboarding flags computed by the server component. */
export interface SetupFlags {
  /** Logo + phone saved on the school (Settings). */
  branded: boolean;
  /** A school-wide student template has been picked (Templates). */
  templatesChosen: boolean;
  /** At least one member exists. */
  studentsAdded: boolean;
  /** At least one ID card has been generated. */
  cardsGenerated: boolean;
}

interface Hero {
  label: string;
  display: string;
  icon: LucideIcon;
}

interface SetupStep {
  done: boolean;
  icon: LucideIcon;
  label: string;
  desc: string;
  href: string;
  cta: string;
}

interface Stage {
  label: string;
  count: number;
  pct: number;
  icon: LucideIcon;
}

export default function DashboardView({
  metrics,
  analytics,
  setup,
  needsLogo,
  trial,
}: {
  metrics: DashboardMetrics;
  analytics: AnalyticsData;
  setup: SetupFlags;
  needsLogo: boolean;
  trial?: TrialStatus | null;
}) {
  const reduce = useReducedMotion();

  const steps: SetupStep[] = [
    {
      done: setup.branded,
      icon: Settings,
      label: "Brand your school",
      desc: "Add your logo, address & phone",
      href: "/settings",
      cta: "Settings",
    },
    {
      done: setup.templatesChosen,
      icon: LayoutTemplate,
      label: "Choose templates",
      desc: "Pick student & staff ID designs",
      href: "/templates",
      cta: "Templates",
    },
    {
      done: setup.studentsAdded,
      icon: Users,
      label: "Add members",
      desc: "Add students and photos",
      href: "/members",
      cta: "Members",
    },
    {
      done: setup.cardsGenerated,
      icon: IdCard,
      label: "Generate cards",
      desc: "Generate & print cards",
      href: "/members",
      cta: "Generate",
    },
  ];
  const showSetup = steps.some((s) => !s.done);

  const pctText = (n: number): string => `${Math.round(n * 100)}%`;

  const pct = (n: number): number =>
    metrics.total > 0 ? Math.round((n / metrics.total) * 100) : 0;

  const heroes: Hero[] = [
    {
      label: "Total Branches",
      display: String(metrics.branches),
      icon: Building2,
    },
    {
      label: "Total Students",
      display: String(analytics.kpis.totalStudents),
      icon: Users,
    },
    {
      label: "Total Staff",
      display: String(analytics.kpis.totalStaff),
      icon: UserCog,
    },
    {
      label: "Photo Coverage",
      display: pctText(analytics.kpis.photoCoverage),
      icon: Camera,
    },
  ];

  const stages: Stage[] = [
    { label: "Image uploaded", count: metrics.imageUploaded, icon: ImageUp },
    { label: "ID Generated", count: metrics.idGenerated, icon: IdCard },
    { label: "Sent for printing", count: metrics.sentForPrinting, icon: Send },
    { label: "Printed", count: metrics.printed, icon: Printer },
  ].map((s) => ({ ...s, pct: pct(s.count) }));

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
      <AutoRefresh seconds={15} />

      {/* Usage-based trial countdown (only for trial schools). */}
      {trial && !trial.expired && (
        <TrialTimer initialRemaining={trial.remaining} limit={trial.limit} />
      )}

      {/* Upload-your-logo prompt — admins/super-admins whose school has no logo yet */}
      {needsLogo && (
        <motion.div
          variants={item}
          className="card mb-6 flex flex-wrap items-center gap-4 border-teal-200 bg-teal-50/60 p-5"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-100 text-teal-700">
            <ImageUp className="h-5 w-5" />
          </div>
          <p className="text-sm font-medium text-slate-800">
            Add your school logo so it appears on every ID card.
          </p>
          <Link href="/settings" className="btn-primary btn-sm ml-auto">
            Upload logo
          </Link>
        </motion.div>
      )}

      {/* Heading */}
      <motion.div variants={item}>
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          Your ID card production funnel at a glance.
        </p>
      </motion.div>

      {/* Get started — onboarding checklist, shown until every step is done */}
      {showSetup && (
        <motion.div variants={item} className="card mt-6 p-6">
          <h2 className="text-sm font-semibold text-slate-900">Get started</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Four quick steps to your first printed ID cards.
          </p>
          <ol className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((s, i) => (
              <li key={s.label} className="flex gap-3">
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                    s.done
                      ? "bg-emerald-50 text-emerald-600"
                      : "bg-slate-100 text-slate-500"
                  }`}
                  aria-label={s.done ? "Done" : `Step ${i + 1}`}
                >
                  {s.done ? <Check className="h-4 w-4" /> : i + 1}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-sm font-medium text-slate-800">
                    <s.icon className="h-4 w-4 shrink-0 text-slate-400" />
                    {s.label}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">{s.desc}</p>
                  <Link
                    href={s.href}
                    className="mt-1 inline-flex items-center gap-0.5 text-xs font-medium text-teal-700 hover:text-teal-800"
                  >
                    {s.cta}
                    <ChevronRight className="h-3 w-3" />
                  </Link>
                </div>
              </li>
            ))}
          </ol>
        </motion.div>
      )}

      {/* Hero stat cards */}
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

      {/* Production funnel */}
      <motion.h2
        variants={item}
        className="mt-8 text-sm font-medium text-slate-500"
      >
        Production funnel
      </motion.h2>

      <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-stretch lg:gap-2">
        {stages.map((stage, i) => (
          <Fragment key={stage.label}>
            <motion.div variants={item} className="card flex-1 p-5">
              <div className="flex items-center justify-between">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                  <stage.icon className="h-5 w-5" />
                </div>
                <span className="text-sm font-semibold text-teal-700">
                  {stage.pct}%
                </span>
              </div>

              <div className="mt-4 text-sm font-medium text-slate-500">
                {stage.label}
              </div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-2xl font-bold text-slate-900">
                  {stage.count}
                </span>
                <span className="text-sm font-medium text-slate-400">
                  / {metrics.total}
                </span>
              </div>

              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <motion.div
                  className="h-full rounded-full bg-teal-600"
                  initial={reduce ? false : { width: 0 }}
                  animate={{ width: `${stage.pct}%` }}
                  transition={{
                    duration: reduce ? 0 : 0.9,
                    ease: "easeOut",
                    delay: reduce ? 0 : 0.35 + i * 0.1,
                  }}
                />
              </div>
            </motion.div>

            {i < stages.length - 1 ? (
              <div
                aria-hidden
                className="hidden shrink-0 items-center self-center lg:flex"
              >
                <ChevronRight className="h-5 w-5 text-slate-300" />
              </div>
            ) : null}
          </Fragment>
        ))}
      </div>

      {/* Analytics */}
      <motion.h2
        variants={item}
        className="mt-8 text-sm font-medium text-slate-500"
      >
        Analytics
      </motion.h2>

      <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <motion.div variants={item}>
          <StatusDonut data={analytics.statusBreakdown} />
        </motion.div>
        <motion.div variants={item}>
          <GeneratedAreaChart data={analytics.generatedByDay} />
        </motion.div>
        <motion.div variants={item}>
          <BranchBarChart data={analytics.perBranch} />
        </motion.div>
        <motion.div variants={item}>
          <ClassBarChart data={analytics.perClass} />
        </motion.div>

        {/* Scan-station activity */}
        <motion.div variants={item} className="lg:col-span-2">
          <div className="card p-5">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50">
                <ScanLine className="h-5 w-5 text-teal-700" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Scan activity</h3>
                <p className="text-xs text-slate-500">
                  <span className="font-semibold text-slate-900">{analytics.scans24h}</span>{" "}
                  card{analytics.scans24h === 1 ? "" : "s"} scanned in the last 24 h
                </p>
              </div>
              <Link href="/scan" className="btn-secondary btn-sm ml-auto">
                Open Scan station
              </Link>
            </div>
            {analytics.recentScans.length > 0 ? (
              <ul className="mt-4 divide-y divide-slate-100">
                {analytics.recentScans.map((s, i) => (
                  <li key={`${s.at}-${i}`} className="flex items-center gap-3 py-2 text-sm">
                    <span className="font-medium text-slate-800">{s.name}</span>
                    {s.identifier ? (
                      <span className="text-xs text-slate-400">{s.identifier}</span>
                    ) : null}
                    {/* Locale/timezone differs between SSR (UTC) and the browser. */}
                    <span suppressHydrationWarning className="ml-auto text-xs text-slate-400">
                      {new Date(s.at).toLocaleString([], {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-slate-400">
                No scans recorded yet — scan any printed card's QR or barcode to check a
                student in.
              </p>
            )}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
