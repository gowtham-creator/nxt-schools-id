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
import type { BranchCount } from "@/lib/analytics";

const TEAL = "#0d9488"; // teal-600

const tooltipContentStyle: React.CSSProperties = {
  borderRadius: 12,
  border: "1px solid #e2e8f0",
  boxShadow: "0 6px 20px rgba(15, 23, 42, 0.08)",
  fontSize: 12,
  padding: "8px 12px",
};

export default function BranchBarChart({ data }: { data: BranchCount[] }) {
  const reduce = useReducedMotion();

  return (
    <div className="card p-5">
      <h3 className="text-sm font-medium text-slate-500">Students per branch</h3>

      <div className="mt-3 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#e2e8f0"
              vertical={false}
            />
            <XAxis
              dataKey="branch"
              tick={{ fill: "#64748b", fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: "#e2e8f0" }}
              interval={0}
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
              dataKey="students"
              name="Students"
              fill={TEAL}
              radius={[6, 6, 0, 0]}
              maxBarSize={48}
              isAnimationActive={!reduce}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
