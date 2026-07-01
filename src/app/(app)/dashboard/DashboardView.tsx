"use client";

import { Fragment } from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import {
  Building2,
  Users,
  UserCog,
  Camera,
  ImageUp,
  IdCard,
  Send,
  Printer,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import type { AnalyticsData } from "@/lib/analytics";
import StatusDonut from "./charts/StatusDonut";
import GeneratedAreaChart from "./charts/GeneratedAreaChart";
import BranchBarChart from "./charts/BranchBarChart";
import ClassBarChart from "./charts/ClassBarChart";

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

interface Hero {
  label: string;
  display: string;
  icon: LucideIcon;
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
}: {
  metrics: DashboardMetrics;
  analytics: AnalyticsData;
}) {
  const reduce = useReducedMotion();

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
      {/* Heading */}
      <motion.div variants={item}>
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          Your ID card production funnel at a glance.
        </p>
      </motion.div>

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
      </div>
    </motion.div>
  );
}
