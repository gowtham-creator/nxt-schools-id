"use client";

import { useReducedMotion } from "framer-motion";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { SchoolBar } from "@/lib/analytics";

const tooltipContentStyle: React.CSSProperties = {
  borderRadius: 12,
  border: "1px solid #e2e8f0",
  boxShadow: "0 6px 20px rgba(15, 23, 42, 0.08)",
  fontSize: 12,
  padding: "8px 12px",
};

/**
 * Horizontal-label bar chart for a per-school metric (students per school,
 * branches per school, …). School names can be long, so the X labels are
 * angled and the container scrolls if there are many bars.
 */
export default function SchoolBarChart({
  data,
  title,
  seriesName,
  color = "#0d9488", // teal-600
}: {
  data: SchoolBar[];
  title: string;
  seriesName: string;
  color?: string;
}) {
  const reduce = useReducedMotion();

  return (
    <div className="card p-5">
      <h3 className="text-sm font-medium text-slate-500">{title}</h3>
      {data.length === 0 ? (
        <p className="mt-6 text-sm text-slate-400">No data yet.</p>
      ) : (
        <div className="mt-3 h-72 overflow-x-auto">
          <div style={{ minWidth: Math.max(320, data.length * 64) }} className="h-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 48 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "#64748b", fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: "#e2e8f0" }}
                  interval={0}
                  angle={-35}
                  textAnchor="end"
                  height={60}
                />
                <YAxis
                  allowDecimals={false}
                  width={32}
                  tick={{ fill: "#64748b", fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  cursor={{ fill: "rgba(15, 118, 110, 0.06)" }}
                  contentStyle={tooltipContentStyle}
                  labelStyle={{ color: "#0f172a", fontWeight: 600 }}
                  itemStyle={{ color: "#334155" }}
                />
                <Bar
                  dataKey="value"
                  name={seriesName}
                  fill={color}
                  radius={[6, 6, 0, 0]}
                  maxBarSize={48}
                  isAnimationActive={!reduce}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
