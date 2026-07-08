import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { MemberType, PipelineStatus } from "@/lib/types";
import PlatformView, {
  type PlatformData,
  type PlatformSchool,
} from "./PlatformView";

export const dynamic = "force-dynamic";

type SchoolRow = {
  id: string;
  name: string;
  short_name: string | null;
  logo_url: string | null;
  phone: string | null;
  created_at: string;
  student_template_id: string | null;
  staff_template_id: string | null;
};

type MemberRow = {
  school_id: string;
  member_type: MemberType;
  pipeline_status: PipelineStatus;
  photo_url: string | null;
};

/** Per-school running counters aggregated from the members query. */
type Tally = { students: number; staff: number; generated: number; printed: number };

const GENERATED_ONWARD: PipelineStatus[] = [
  "generated",
  "print_approval_pending",
  "sent_for_printing",
  "printed",
];

export default async function PlatformPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  await requireRole(["super_admin"]);
  const sp = await searchParams;

  // Service-role client on purpose: this is the platform view across ALL
  // tenant schools, and the page is super_admin-gated above — the RLS bypass
  // is intentional and safe here. Never use this client on tenant pages.
  const admin = createAdminClient();

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [schoolsRes, membersRes, usersRes, auditRes, authRes] = await Promise.all([
    admin
      .from("schools")
      .select(
        "id, name, short_name, logo_url, phone, created_at, student_template_id, staff_template_id",
      )
      .order("created_at", { ascending: true }),
    admin
      .from("members")
      .select("school_id, member_type, pipeline_status, photo_url")
      .limit(20000),
    admin.from("app_users").select("id, school_id, role"),
    admin
      .from("audit_log")
      .select("school_id, created_at")
      .eq("action", "card.generated")
      .gte("created_at", since),
    admin.auth.admin.listUsers({ perPage: 1000 }),
  ]);

  const schools = (schoolsRes.data ?? []) as SchoolRow[];
  const members = (membersRes.data ?? []) as MemberRow[];
  const appUsers = (usersRes.data ?? []) as {
    id: string;
    school_id: string | null;
    role: string;
  }[];
  const weekAudit = (auditRes.data ?? []) as { school_id: string | null }[];

  // A tenant is "suspended" when all its non-super-admin logins are banned in
  // auth. Build the banned set once, then the per-tenant login lists.
  const nowMs = Date.now();
  const bannedIds = new Set<string>();
  for (const u of authRes.data?.users ?? []) {
    const bannedUntil = (u as { banned_until?: string | null }).banned_until;
    if (bannedUntil && new Date(bannedUntil).getTime() > nowMs) bannedIds.add(u.id);
  }
  const tenantLoginIds = new Map<string, string[]>();
  for (const u of appUsers) {
    if (!u.school_id || u.role === "super_admin") continue;
    const list = tenantLoginIds.get(u.school_id) ?? [];
    list.push(u.id);
    tenantLoginIds.set(u.school_id, list);
  }

  // Aggregate everything in JS — one pass per result set.
  const tally = new Map<string, Tally>();
  let students = 0;
  let staff = 0;
  let cardsGenerated = 0;
  let cardsPrinted = 0;
  for (const m of members) {
    const t =
      tally.get(m.school_id) ??
      ({ students: 0, staff: 0, generated: 0, printed: 0 } as Tally);
    if (m.member_type === "staff") {
      t.staff += 1;
      staff += 1;
    } else {
      t.students += 1;
      students += 1;
    }
    if (GENERATED_ONWARD.includes(m.pipeline_status)) {
      t.generated += 1;
      cardsGenerated += 1;
    }
    if (m.pipeline_status === "printed") {
      t.printed += 1;
      cardsPrinted += 1;
    }
    tally.set(m.school_id, t);
  }

  const usersBySchool = new Map<string, number>();
  for (const u of appUsers) {
    if (!u.school_id) continue;
    usersBySchool.set(u.school_id, (usersBySchool.get(u.school_id) ?? 0) + 1);
  }

  const weekBySchool = new Map<string, number>();
  for (const a of weekAudit) {
    if (!a.school_id) continue;
    weekBySchool.set(a.school_id, (weekBySchool.get(a.school_id) ?? 0) + 1);
  }

  const perSchool: PlatformSchool[] = schools
    .map((s) => {
      const t = tally.get(s.id);
      const loginIds = tenantLoginIds.get(s.id) ?? [];
      return {
        id: s.id,
        name: s.name,
        shortName: s.short_name,
        logoUrl: s.logo_url,
        phone: s.phone,
        createdAt: s.created_at,
        students: t?.students ?? 0,
        staff: t?.staff ?? 0,
        generated: t?.generated ?? 0,
        printed: t?.printed ?? 0,
        users: usersBySchool.get(s.id) ?? 0,
        weekActivity: weekBySchool.get(s.id) ?? 0,
        templatesReady: Boolean(s.student_template_id && s.staff_template_id),
        suspended: loginIds.length > 0 && loginIds.every((id) => bannedIds.has(id)),
      };
    })
    .sort((a, b) => b.students - a.students);

  const data: PlatformData = {
    totals: {
      schools: schools.length,
      students,
      staff,
      cardsGenerated,
      cardsPrinted,
    },
    perSchool,
  };

  return <PlatformView data={data} ok={sp.ok} error={sp.error} />;
}
