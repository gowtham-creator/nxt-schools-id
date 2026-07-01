"use client";

import { useReducedMotion } from "framer-motion";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import type { StatusSlice } from "@/lib/analytics";

/** Per-stage palette: teal · blue · amber · indigo · emerald. */
const STATUS_COLORS: Record<StatusSlice["status"], string> = {
  not_generated: "#0d9488", // teal-600
  generated: "#3b82f6", // blue-500
  print_approval_pending: "#f59e0b", // amber-500
  sent_for_printing: "#6366f1", // indigo-500
  printed: "#10b981", // emerald-500
};

const tooltipContentStyle: React.CSSProperties = {
  borderRadius: 12,
  border: "1px solid #e2e8f0",
  boxShadow: "0 6px 20px rgba(15, 23, 42, 0.08)",
  fontSize: 12,
  padding: "8px 12px",
};

export default function StatusDonut({ data }: { data: StatusSlice[] }) {
  const reduce = useReducedMotion();
  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className="card p-5">
      <h3 className="text-sm font-medium text-slate-500">Pipeline status</h3>

      <div className="mt-3 flex flex-col items-center gap-4 sm:flex-row">
        {/* Donut + centred total */}
        <div className="relative h-64 w-full sm:w-1/2">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="count"
                nameKey="label"
                cx="50%"
                cy="50%"
                innerRadius={62}
                outerRadius={92}
                paddingAngle={2}
                stroke="none"
                isAnimationActive={!reduce}
              >
                {data.map((d) => (
                  <Cell key={d.status} fill={STATUS_COLORS[d.status]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={tooltipContentStyle}
                labelStyle={{ color: "#0f172a", fontWeight: 600 }}
                itemStyle={{ color: "#334155" }}
              />
            </PieChart>
          </ResponsiveContainer>

          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold leading-none text-slate-900">
              {total}
            </span>
            <span className="mt-1 text-xs font-medium text-slate-400">
              Total
            </span>
          </div>
        </div>

        {/* Legend */}
        <ul className="w-full space-y-2 sm:w-1/2">
          {data.map((d) => (
            <li
              key={d.status}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: STATUS_COLORS[d.status] }}
                />
                <span className="truncate text-slate-600">{d.label}</span>
              </span>
              <span className="shrink-0 font-semibold text-slate-900">
                {d.count}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
