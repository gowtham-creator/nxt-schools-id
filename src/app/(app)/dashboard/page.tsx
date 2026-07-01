import { createClient } from "@/lib/supabase/server";
import type { PipelineStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

// Pipeline stages that count as "ID generated" (everything from generation onward).
const GENERATED_STATUSES: PipelineStatus[] = [
  "generated",
  "print_approval_pending",
  "sent_for_printing",
  "printed",
];
// Stages that count as "sent for printing" (sent + already printed).
const SENT_STATUSES: PipelineStatus[] = ["sent_for_printing", "printed"];

export default async function DashboardPage() {
  const supabase = await createClient();

  // Fresh head-count query against members for each funnel filter.
  const members = () =>
    supabase.from("members").select("*", { count: "exact", head: true });

  const [
    totalBranches,
    totalStudents,
    imageUploaded,
    idGenerated,
    sentForPrinting,
    printed,
  ] = await Promise.all([
    supabase
      .from("branches")
      .select("*", { count: "exact", head: true })
      .then((r) => r.count ?? 0),
    members().then((r) => r.count ?? 0),
    members()
      .not("photo_url", "is", null)
      .then((r) => r.count ?? 0),
    members()
      .in("pipeline_status", GENERATED_STATUSES)
      .then((r) => r.count ?? 0),
    members()
      .in("pipeline_status", SENT_STATUSES)
      .then((r) => r.count ?? 0),
    members()
      .eq("pipeline_status", "printed")
      .then((r) => r.count ?? 0),
  ]);

  const funnel: {
    label: string;
    done: number;
    card: string;
    value: string;
    sub: string;
    bar: string;
  }[] = [
    {
      label: "Image uploaded",
      done: imageUploaded,
      card: "border-amber-200 bg-amber-50",
      value: "text-amber-900",
      sub: "text-amber-700",
      bar: "bg-amber-500",
    },
    {
      label: "ID Generated",
      done: idGenerated,
      card: "border-blue-200 bg-blue-50",
      value: "text-blue-900",
      sub: "text-blue-700",
      bar: "bg-blue-500",
    },
    {
      label: "Sent for printing",
      done: sentForPrinting,
      card: "border-rose-200 bg-rose-50",
      value: "text-rose-900",
      sub: "text-rose-700",
      bar: "bg-rose-500",
    },
    {
      label: "Printed",
      done: printed,
      card: "border-emerald-200 bg-emerald-50",
      value: "text-emerald-900",
      sub: "text-emerald-700",
      bar: "bg-emerald-500",
    },
  ];

  const pct = (n: number) =>
    totalStudents > 0 ? Math.round((n / totalStudents) * 100) : 0;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
      <p className="mt-1 text-sm text-slate-500">
        Your ID card production funnel at a glance.
      </p>

      {/* Top row — headline totals */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="card p-6">
          <div className="text-sm font-medium text-slate-500">
            Total Branches
          </div>
          <div className="mt-2 text-4xl font-semibold text-slate-900">
            {totalBranches}
          </div>
        </div>
        <div className="rounded-xl border border-teal-200 bg-teal-50 p-6 shadow-sm">
          <div className="text-sm font-medium text-teal-700">
            Total Students
          </div>
          <div className="mt-2 text-4xl font-semibold text-teal-900">
            {totalStudents}
          </div>
        </div>
      </div>

      {/* Funnel row */}
      <h2 className="mt-8 text-sm font-medium text-slate-500">
        Production funnel
      </h2>
      <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {funnel.map((s) => (
          <div key={s.label} className={`rounded-xl border p-5 shadow-sm ${s.card}`}>
            <div className={`text-3xl font-semibold ${s.value}`}>
              {s.done}
              <span className="text-xl font-normal text-slate-400">
                {" / "}
                {totalStudents}
              </span>
            </div>
            <div className={`mt-1 text-sm font-medium ${s.sub}`}>{s.label}</div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/70">
              <div
                className={`h-full rounded-full ${s.bar}`}
                style={{ width: `${pct(s.done)}%` }}
              />
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {pct(s.done)}% of students
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
