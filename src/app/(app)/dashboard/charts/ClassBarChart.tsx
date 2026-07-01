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
import type { ClassCount } from "@/lib/analytics";

const TEAL = "#14b8a6"; // teal-500

const tooltipContentStyle: React.CSSProperties = {
  borderRadius: 12,
  border: "1px solid #e2e8f0",
  boxShadow: "0 6px 20px rgba(15, 23, 42, 0.08)",
  fontSize: 12,
  padding: "8px 12px",
};

export default function ClassBarChart({ data }: { data: ClassCount[] }) {
  const reduce = useReducedMotion();

  return (
    <div className="card p-5">
      <h3 className="text-sm font-medium text-slate-500">Top classes</h3>

      <div className="mt-3 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 8, right: 16, left: 8, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#e2e8f0"
              horizontal={false}
            />
            <XAxis
              type="number"
              allowDecimals={false}
              tick={{ fill: "#64748b", fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: "#e2e8f0" }}
            />
            <YAxis
              type="category"
              dataKey="klass"
              width={96}
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
              radius={[0, 6, 6, 0]}
              maxBarSize={28}
              isAnimationActive={!reduce}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
