"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";
import {
  School,
  Building2,
  GraduationCap,
  UserCog,
  IdCard,
  CircleDashed,
  Send,
  Printer,
  type LucideIcon,
} from "lucide-react";
import type { PlatformAnalytics } from "@/lib/analytics";
import StatusDonut from "./charts/StatusDonut";
import GeneratedAreaChart from "./charts/GeneratedAreaChart";
import SchoolBarChart from "./charts/SchoolBarChart";
import AutoRefresh from "../AutoRefresh";

interface Kpi {
  label: string;
  value: number;
  icon: LucideIcon;
  tint: string;
}

const NUM = new Intl.NumberFormat("en-US");

/**
 * Live, platform-wide analytics for the super admin: headline KPIs across every
 * school plus dynamic charts (pipeline donut, students/branches per school,
 * cards generated over time). Auto-refreshes so it tracks schools as they use
 * the app.
 */
export default function PlatformDashboard({ data }: { data: PlatformAnalytics }) {
  const reduce = useReducedMotion();
  const k = data.kpis;

  const kpis: Kpi[] = [
    { label: "Schools", value: k.totalSchools, icon: School, tint: "bg-teal-50 text-teal-700" },
    { label: "Sub-branches", value: k.totalBranches, icon: Building2, tint: "bg-teal-50 text-teal-700" },
    { label: "Students", value: k.totalStudents, icon: GraduationCap, tint: "bg-blue-50 text-blue-700" },
    { label: "Teachers & staff", value: k.totalStaff, icon: UserCog, tint: "bg-blue-50 text-blue-700" },
    { label: "IDs generated", value: k.cardsGenerated, icon: IdCard, tint: "bg-emerald-50 text-emerald-700" },
    { label: "IDs not generated", value: k.cardsNotGenerated, icon: CircleDashed, tint: "bg-amber-50 text-amber-700" },
    { label: "Sent for printing", value: k.sentForPrinting, icon: Send, tint: "bg-indigo-50 text-indigo-700" },
    { label: "Printed", value: k.cardsPrinted, icon: Printer, tint: "bg-slate-100 text-slate-600" },
  ];

  const container: Variants = {
    hidden: {},
    show: {
      transition: { staggerChildren: reduce ? 0 : 0.05, delayChildren: reduce ? 0 : 0.03 },
    },
  };
  const item: Variants = {
    hidden: reduce ? { opacity: 0 } : { opacity: 0, y: 14 },
    show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
  };

  const totalCards = k.cardsGenerated + k.cardsNotGenerated;
  const genPct = totalCards > 0 ? Math.round((k.cardsGenerated / totalCards) * 100) : 0;

  return (
    <motion.div variants={container} initial="hidden" animate="show">
      <AutoRefresh seconds={12} />

      <motion.div variants={item}>
        <h1 className="text-2xl font-semibold text-slate-900">Platform analytics</h1>
        <p className="mt-1 text-sm text-slate-500">
          Live across every school on NXT School ID. Updates automatically.
        </p>
      </motion.div>

      {/* KPI grid */}
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <motion.div key={kpi.label} variants={item} className="card flex items-center gap-3 p-5">
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${kpi.tint}`}>
              <kpi.icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="text-2xl font-bold leading-none tabular-nums text-slate-900">
                {NUM.format(kpi.value)}
              </div>
              <div className="mt-1 text-xs font-medium text-slate-500">{kpi.label}</div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ID generation progress bar */}
      <motion.div variants={item} className="card mt-4 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-medium text-slate-500">ID cards generated</h3>
          <span className="text-sm font-semibold text-emerald-600">
            {NUM.format(k.cardsGenerated)} of {NUM.format(totalCards)} ({genPct}%)
          </span>
        </div>
        <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
          <motion.div
            className="h-full rounded-full bg-emerald-500"
            initial={reduce ? false : { width: 0 }}
            animate={{ width: `${genPct}%` }}
            transition={{ duration: reduce ? 0 : 0.8, ease: "easeOut" }}
          />
        </div>
        <p className="mt-2 text-xs text-slate-400">
          {NUM.format(k.cardsNotGenerated)} still not generated · {NUM.format(k.sentForPrinting)}{" "}
          sent for printing · {NUM.format(k.cardsPrinted)} printed
        </p>
      </motion.div>

      {/* Charts */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <motion.div variants={item}>
          <StatusDonut data={data.statusBreakdown} />
        </motion.div>
        <motion.div variants={item}>
          <GeneratedAreaChart data={data.generatedByDay} />
        </motion.div>
        <motion.div variants={item}>
          <SchoolBarChart
            data={data.studentsPerSchool}
            title="Students per school"
            seriesName="Students"
          />
        </motion.div>
        <motion.div variants={item}>
          <SchoolBarChart
            data={data.branchesPerSchool}
            title="Sub-branches per school"
            seriesName="Branches"
            color="#4f46e5"
          />
        </motion.div>
      </div>
    </motion.div>
  );
}
