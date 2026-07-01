import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { MemberType, PipelineStatus } from "@/lib/types";

/* ─────────────────────────────────────────────────────────────
   Dashboard analytics — a few RLS-scoped selects, aggregated in JS.
   Consumed by the server component and passed (serializable) to the
   client charts. Keep this module server-only.
   ───────────────────────────────────────────────────────────── */

/** One slice of the pipeline-status donut (all 5 stages, always present). */
export interface StatusSlice {
  status: PipelineStatus;
  label: string;
  count: number;
}

/** One day bucket for the "cards generated" area chart. */
export interface DayCount {
  /** ISO date, 'YYYY-MM-DD'. */
  date: string;
  count: number;
}

/** Members grouped by branch name. */
export interface BranchCount {
  branch: string;
  students: number;
}

/** Members grouped by class (name + optional section). */
export interface ClassCount {
  klass: string;
  students: number;
}

/** Headline KPIs. */
export interface DashboardKpis {
  totalBranches: number;
  totalStudents: number;
  totalStaff: number;
  cardsPrinted: number;
  /** Fraction 0..1 of members with a photo uploaded. */
  photoCoverage: number;
}

/** Fully-typed, serializable payload for the dashboard. */
export interface AnalyticsData {
  kpis: DashboardKpis;
  statusBreakdown: StatusSlice[];
  generatedByDay: DayCount[];
  perBranch: BranchCount[];
  perClass: ClassCount[];
}

/** All 5 pipeline stages in display order, with human labels. */
const STATUS_ORDER: ReadonlyArray<{ status: PipelineStatus; label: string }> = [
  { status: "not_generated", label: "Not Generated" },
  { status: "generated", label: "Generated" },
  { status: "print_approval_pending", label: "Print Approval" },
  { status: "sent_for_printing", label: "Sent for Printing" },
  { status: "printed", label: "Printed" },
];

const DAY_WINDOW = 14;
const TOP_CLASSES = 8;

/** Minimal shape of the member columns we aggregate over. */
interface MemberAggRow {
  member_type: MemberType;
  pipeline_status: PipelineStatus;
  photo_url: string | null;
  branch_id: string | null;
  class_id: string | null;
  card_generated_at: string | null;
}

interface BranchRow {
  id: string;
  name: string;
}

interface ClassNameRow {
  id: string;
  name: string;
  section: string | null;
}

/** 'YYYY-MM-DD' in UTC for a timestamp string, or null if unparseable. */
function toDay(iso: string | null): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return new Date(t).toISOString().slice(0, 10);
}

/** The last `DAY_WINDOW` UTC dates, oldest → newest, as 'YYYY-MM-DD'. */
function recentDays(count: number): string[] {
  const now = new Date();
  const base = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  const dayMs = 24 * 60 * 60 * 1000;
  const out: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    out.push(new Date(base - i * dayMs).toISOString().slice(0, 10));
  }
  return out;
}

/**
 * Fetch + aggregate dashboard analytics for a school.
 * Queries run under RLS; `schoolId` (when known) narrows them further.
 */
export async function getDashboardAnalytics(
  supabase: SupabaseClient,
  schoolId: string | null,
): Promise<AnalyticsData> {
  let membersQ = supabase
    .from("members")
    .select(
      "member_type,pipeline_status,photo_url,branch_id,class_id,card_generated_at",
    )
    .limit(5000);
  let branchesQ = supabase.from("branches").select("id,name");
  let classesQ = supabase.from("classes").select("id,name,section");

  if (schoolId) {
    membersQ = membersQ.eq("school_id", schoolId);
    branchesQ = branchesQ.eq("school_id", schoolId);
    classesQ = classesQ.eq("school_id", schoolId);
  }

  const [membersRes, branchesRes, classesRes] = await Promise.all([
    membersQ,
    branchesQ,
    classesQ,
  ]);

  const members = (membersRes.data ?? []) as unknown as MemberAggRow[];
  const branches = (branchesRes.data ?? []) as unknown as BranchRow[];
  const classes = (classesRes.data ?? []) as unknown as ClassNameRow[];

  const totalMembers = members.length;

  // ── KPIs ────────────────────────────────────────────────────
  let totalStudents = 0;
  let totalStaff = 0;
  let cardsPrinted = 0;
  let withPhoto = 0;

  // ── Aggregation maps ────────────────────────────────────────
  const statusCounts = new Map<PipelineStatus, number>();
  const branchCounts = new Map<string | null, number>();
  const classCounts = new Map<string, number>();
  const dayCounts = new Map<string, number>();

  for (const m of members) {
    if (m.member_type === "student") totalStudents++;
    else if (m.member_type === "staff") totalStaff++;
    if (m.pipeline_status === "printed") cardsPrinted++;
    if (m.photo_url != null && m.photo_url !== "") withPhoto++;

    statusCounts.set(
      m.pipeline_status,
      (statusCounts.get(m.pipeline_status) ?? 0) + 1,
    );
    branchCounts.set(m.branch_id, (branchCounts.get(m.branch_id) ?? 0) + 1);
    if (m.class_id) {
      classCounts.set(m.class_id, (classCounts.get(m.class_id) ?? 0) + 1);
    }

    const day = toDay(m.card_generated_at);
    if (day) dayCounts.set(day, (dayCounts.get(day) ?? 0) + 1);
  }

  const kpis: DashboardKpis = {
    totalBranches: branches.length,
    totalStudents,
    totalStaff,
    cardsPrinted,
    photoCoverage: totalMembers > 0 ? withPhoto / totalMembers : 0,
  };

  // ── Status breakdown (all 5 stages, ordered) ────────────────
  const statusBreakdown: StatusSlice[] = STATUS_ORDER.map((s) => ({
    status: s.status,
    label: s.label,
    count: statusCounts.get(s.status) ?? 0,
  }));

  // ── Generated-by-day (continuous 14-day window, zero-filled) ─
  const generatedByDay: DayCount[] = recentDays(DAY_WINDOW).map((date) => ({
    date,
    count: dayCounts.get(date) ?? 0,
  }));

  // ── Per-branch (every branch, incl. zero; + Unassigned) ─────
  const perBranch: BranchCount[] = branches.map((b) => ({
    branch: b.name,
    students: branchCounts.get(b.id) ?? 0,
  }));
  const unassigned = branchCounts.get(null) ?? 0;
  if (unassigned > 0) {
    perBranch.push({ branch: "Unassigned", students: unassigned });
  }
  perBranch.sort((a, b) => b.students - a.students);

  // ── Top classes by student count ────────────────────────────
  const classLabel = new Map<string, string>(
    classes.map((c) => [
      c.id,
      c.section ? `${c.name} ${c.section}` : c.name,
    ]),
  );
  const perClass: ClassCount[] = [...classCounts.entries()]
    .map(([id, students]) => ({
      klass: classLabel.get(id) ?? "Unknown",
      students,
    }))
    .sort((a, b) => b.students - a.students)
    .slice(0, TOP_CLASSES);

  return { kpis, statusBreakdown, generatedByDay, perBranch, perClass };
}
