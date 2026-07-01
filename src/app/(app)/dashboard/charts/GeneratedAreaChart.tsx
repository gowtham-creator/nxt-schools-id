"use client";

import { useReducedMotion } from "framer-motion";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DayCount } from "@/lib/analytics";

const TEAL = "#0d9488"; // teal-600

const tooltipContentStyle: React.CSSProperties = {
  borderRadius: 12,
  border: "1px solid #e2e8f0",
  boxShadow: "0 6px 20px rgba(15, 23, 42, 0.08)",
  fontSize: 12,
  padding: "8px 12px",
};

/** 'YYYY-MM-DD' → e.g. "Jul 2". */
function shortDate(value: string): string {
  const t = Date.parse(`${value}T00:00:00Z`);
  if (Number.isNaN(t)) return value;
  return new Date(t).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default function GeneratedAreaChart({ data }: { data: DayCount[] }) {
  const reduce = useReducedMotion();

  return (
    <div className="card p-5">
      <h3 className="text-sm font-medium text-slate-500">
        Cards generated · last 14 days
      </h3>

      <div className="mt-3 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
          >
            <defs>
              <linearGradient id="genFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={TEAL} stopOpacity={0.35} />
                <stop offset="100%" stopColor={TEAL} stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#e2e8f0"
              vertical={false}
            />
            <XAxis
              dataKey="date"
              tickFormatter={shortDate}
              tick={{ fill: "#64748b", fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: "#e2e8f0" }}
              minTickGap={16}
            />
            <YAxis
              allowDecimals={false}
              width={32}
              tick={{ fill: "#64748b", fontSize: 12 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              labelFormatter={(value) => shortDate(String(value))}
              contentStyle={tooltipContentStyle}
              labelStyle={{ color: "#0f172a", fontWeight: 600 }}
              itemStyle={{ color: "#334155" }}
              cursor={{ stroke: TEAL, strokeWidth: 1, strokeOpacity: 0.4 }}
            />
            <Area
              type="monotone"
              dataKey="count"
              name="Generated"
              stroke={TEAL}
              strokeWidth={2}
              fill="url(#genFill)"
              dot={false}
              activeDot={{ r: 4 }}
              isAnimationActive={!reduce}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
