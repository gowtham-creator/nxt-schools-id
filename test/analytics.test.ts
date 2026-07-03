import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getDashboardAnalytics } from "@/lib/analytics";
import type { MemberType, PipelineStatus } from "@/lib/types";

/* ── Fake Supabase client ─────────────────────────────────────
   analytics.ts builds thenable query chains:
     from("members").select(...).limit(5000)[.eq("school_id", id)]
     from("branches").select("id,name")[.eq(...)]
     from("classes").select("id,name,section")[.eq(...)]
   and awaits them via Promise.all, so each chain must be a
   PromiseLike resolving to { data, error }. */

type Row = Record<string, unknown>;

interface QueryResult {
  data: Row[];
  error: null;
  count: number | null;
}

interface FakeQuery extends PromiseLike<QueryResult> {
  select(cols: string, opts?: { count?: string; head?: boolean }): FakeQuery;
  limit(n: number): FakeQuery;
  eq(col: string, val: unknown): FakeQuery;
  gte(col: string, val: unknown): FakeQuery;
  order(col: string, opts?: { ascending?: boolean }): FakeQuery;
  in(col: string, vals: unknown[]): FakeQuery;
}

function makeFakeClient(
  tables: Record<string, Row[]>,
  eqCalls: string[] = [],
): SupabaseClient {
  const from = (table: string): FakeQuery => {
    const rows = tables[table] ?? [];
    const result: QueryResult = { data: rows, error: null, count: rows.length };
    const q: FakeQuery = {
      select: () => q,
      limit: () => q,
      eq: (col, val) => {
        eqCalls.push(`${table}.${col}=${String(val)}`);
        return q;
      },
      gte: () => q,
      order: () => q,
      in: () => q,
      then: (onfulfilled, onrejected) =>
        Promise.resolve(result).then(onfulfilled, onrejected),
    };
    return q;
  };
  return { from } as unknown as SupabaseClient;
}

/* ── Fixtures ─────────────────────────────────────────────────*/

interface MemberAggRow extends Row {
  member_type: MemberType;
  pipeline_status: PipelineStatus;
  photo_url: string | null;
  branch_id: string | null;
  class_id: string | null;
  card_generated_at: string | null;
}

function makeMemberRow(overrides: Partial<MemberAggRow> = {}): MemberAggRow {
  return {
    member_type: "student",
    pipeline_status: "not_generated",
    photo_url: null,
    branch_id: null,
    class_id: null,
    card_generated_at: null,
    ...overrides,
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;
const now = Date.now();
/** ISO timestamp `d` whole days before now (UTC-safe: no DST in UTC). */
const daysAgoIso = (d: number): string => new Date(now - d * DAY_MS).toISOString();
/** 'YYYY-MM-DD' UTC day for a timestamp. */
const isoDay = (t: number): string => new Date(t).toISOString().slice(0, 10);

describe("getDashboardAnalytics", () => {
  it("computes the headline KPIs", async () => {
    const members = [
      makeMemberRow({ photo_url: "https://cdn.example.com/1.jpg" }),
      makeMemberRow({ photo_url: "" }), // empty string counts as NO photo
      makeMemberRow({ member_type: "staff", pipeline_status: "printed" }),
      makeMemberRow({
        member_type: "staff",
        pipeline_status: "printed",
        photo_url: "https://cdn.example.com/2.jpg",
      }),
      makeMemberRow(),
    ];
    const branches = [
      { id: "b1", name: "Main Campus" },
      { id: "b2", name: "Annex" },
    ];
    const client = makeFakeClient({ members, branches, classes: [] });

    const { kpis } = await getDashboardAnalytics(client, null);

    expect(kpis.totalBranches).toBe(2);
    expect(kpis.totalStudents).toBe(3);
    expect(kpis.totalStaff).toBe(2);
    expect(kpis.cardsPrinted).toBe(2);
    expect(kpis.photoCoverage).toBeCloseTo(2 / 5, 10);
  });

  it("returns photoCoverage 0 when there are no members", async () => {
    const client = makeFakeClient({ members: [], branches: [], classes: [] });
    const { kpis } = await getDashboardAnalytics(client, null);
    expect(kpis.photoCoverage).toBe(0);
    expect(kpis.totalStudents).toBe(0);
  });

  it("returns all 5 pipeline stages in order with correct counts", async () => {
    const members = [
      makeMemberRow({ pipeline_status: "not_generated" }),
      makeMemberRow({ pipeline_status: "not_generated" }),
      makeMemberRow({ pipeline_status: "generated" }),
      makeMemberRow({ pipeline_status: "sent_for_printing" }),
      makeMemberRow({ pipeline_status: "printed" }),
      makeMemberRow({ pipeline_status: "printed" }),
      makeMemberRow({ pipeline_status: "printed" }),
    ];
    const client = makeFakeClient({ members, branches: [], classes: [] });

    const { statusBreakdown } = await getDashboardAnalytics(client, null);

    expect(statusBreakdown).toEqual([
      { status: "not_generated", label: "Not Generated", count: 2 },
      { status: "generated", label: "Generated", count: 1 },
      { status: "print_approval_pending", label: "Print Approval", count: 0 },
      { status: "sent_for_printing", label: "Sent for Printing", count: 1 },
      { status: "printed", label: "Printed", count: 3 },
    ]);
  });

  it("zero-fills a continuous 14-day generated-by-day window", async () => {
    const members = [
      makeMemberRow({ card_generated_at: daysAgoIso(0) }),
      makeMemberRow({ card_generated_at: daysAgoIso(3) }),
      makeMemberRow({ card_generated_at: daysAgoIso(3) }),
      makeMemberRow({ card_generated_at: daysAgoIso(30) }), // out of window
      makeMemberRow({ card_generated_at: null }),
      makeMemberRow({ card_generated_at: "not-a-date" }),
    ];
    const client = makeFakeClient({ members, branches: [], classes: [] });

    const { generatedByDay } = await getDashboardAnalytics(client, null);

    expect(generatedByDay).toHaveLength(14);

    // Continuous, oldest -> newest: every date is exactly +1 day.
    for (let i = 1; i < generatedByDay.length; i++) {
      const prev = Date.parse(`${generatedByDay[i - 1].date}T00:00:00Z`);
      const cur = Date.parse(`${generatedByDay[i].date}T00:00:00Z`);
      expect(cur - prev).toBe(DAY_MS);
    }

    const byDate = new Map(generatedByDay.map((d) => [d.date, d.count]));
    expect(byDate.get(isoDay(now))).toBe(1);
    expect(byDate.get(isoDay(now - 3 * DAY_MS))).toBe(2);
    // The 30-days-ago row is outside the window; every other bucket is 0.
    const total = generatedByDay.reduce((sum, d) => sum + d.count, 0);
    expect(total).toBe(3);
  });

  it("includes zero-count branches and an Unassigned bucket, sorted by count", async () => {
    const members = [
      makeMemberRow({ branch_id: "b1" }),
      makeMemberRow({ branch_id: "b1" }),
      makeMemberRow({ branch_id: null }),
    ];
    const branches = [
      { id: "b1", name: "Main Campus" },
      { id: "b2", name: "Annex" }, // no members -> still listed with 0
    ];
    const client = makeFakeClient({ members, branches, classes: [] });

    const { perBranch } = await getDashboardAnalytics(client, null);

    expect(perBranch).toEqual([
      { branch: "Main Campus", students: 2 },
      { branch: "Unassigned", students: 1 },
      { branch: "Annex", students: 0 },
    ]);
  });

  it("labels classes as name + section and counts members per class", async () => {
    const members = [
      makeMemberRow({ class_id: "c1" }),
      makeMemberRow({ class_id: "c1" }),
      makeMemberRow({ class_id: "c1" }),
      makeMemberRow({ class_id: "c2" }),
      makeMemberRow({ class_id: "c2" }),
      makeMemberRow({ class_id: "c-missing" }),
      makeMemberRow({ class_id: null }), // not counted per-class
    ];
    const classes = [
      { id: "c1", name: "5", section: "B" },
      { id: "c2", name: "LKG", section: null },
    ];
    const client = makeFakeClient({ members, branches: [], classes });

    const { perClass } = await getDashboardAnalytics(client, null);

    expect(perClass).toEqual([
      { klass: "5 B", students: 3 },
      { klass: "LKG", students: 2 },
      { klass: "Unknown", students: 1 },
    ]);
  });

  it("narrows every table by school_id when one is provided (and not when null)", async () => {
    const schoolScoped = (calls: string[]) =>
      calls.filter((c) => c.includes(".school_id=")).sort();

    const scoped: string[] = [];
    await getDashboardAnalytics(
      makeFakeClient({ members: [], branches: [], classes: [] }, scoped),
      "school-1",
    );
    // audit_log is scoped twice: the recent-scans list and the 24h head count.
    expect(schoolScoped(scoped)).toEqual([
      "audit_log.school_id=school-1",
      "audit_log.school_id=school-1",
      "branches.school_id=school-1",
      "classes.school_id=school-1",
      "members.school_id=school-1",
    ]);

    const unscoped: string[] = [];
    await getDashboardAnalytics(
      makeFakeClient({ members: [], branches: [], classes: [] }, unscoped),
      null,
    );
    expect(schoolScoped(unscoped)).toEqual([]);
  });

  it("resolves recent card.scanned events to member names (Unknown for misses)", async () => {
    const members = [
      makeMemberRow({
        id: "m1",
        first_name: "Ananya",
        last_name: "Sharma",
        identifier: "NXT-2025-001",
      }),
    ];
    const audit_log = [
      { entity_id: "m1", created_at: daysAgoIso(0) },
      { entity_id: "ghost", created_at: daysAgoIso(1) },
    ];
    const client = makeFakeClient({ members, branches: [], classes: [], audit_log });

    const { recentScans } = await getDashboardAnalytics(client, null);

    expect(recentScans).toEqual([
      { at: audit_log[0].created_at, name: "Ananya Sharma", identifier: "NXT-2025-001" },
      { at: audit_log[1].created_at, name: "Unknown member", identifier: null },
    ]);
  });
});
