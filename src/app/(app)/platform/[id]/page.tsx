import Link from "next/link";
import { notFound } from "next/navigation";
import { Building2 } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PipelineStatus } from "@/lib/types";
import AutoRefresh from "../../AutoRefresh";

export const dynamic = "force-dynamic";

/** The single tenant this page renders (service-role read, super_admin-gated). */
type SchoolDetail = {
  id: string;
  name: string;
  short_name: string | null;
  logo_url: string | null;
  phone: string | null;
  address: string | null;
  academic_year: string | null;
  created_at: string;
  student_template_id: string | null;
  staff_template_id: string | null;
};

/** One recent audit row, with the actor name embedded from `app_users`. */
type AuditRow = {
  id: number;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  created_at: string;
  actor: { full_name: string | null } | null;
};

/** Pipeline statuses that count a card as generated (…through printed). */
const GENERATED_ONWARD: PipelineStatus[] = [
  "generated",
  "print_approval_pending",
  "sent_for_printing",
  "printed",
];

/** Human labels per audit action (mirrors the school audit log page). */
const ACTION_LABELS: Record<string, string> = {
  "card.generated": "Card generated",
  "card.status_changed": "Card status changed",
  "card.scanned": "Card scanned",
  "sheet.printed": "Print sheet",
  "member.created": "Member created",
  "member.deleted": "Member deleted",
  "user.invited": "User invited",
  "user.role_changed": "Role changed",
  "user.removed": "User removed",
  "template.created": "Template created",
  "template.deleted": "Template deleted",
  "template.pushed": "Template pushed",
  "school.onboarded": "School onboarded",
  "school.suspended": "School suspended",
  "school.reactivated": "School reactivated",
  "school.logo_updated": "Logo updated",
};

function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

/** Compact "2h ago" style relative time (computed server-side per request). */
function relativeTime(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const s = Math.floor(diff / 1000);
  if (s < 45) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(d / 365)}y ago`;
}

// Fixed locale + UTC keep server and client render identical (no hydration drift).
const JOINED = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const NUM = new Intl.NumberFormat("en-US");

export default async function SchoolDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["super_admin"]);
  const { id } = await params;

  // Service-role client on purpose: this is a cross-tenant platform view and the
  // page is super_admin-gated above. Never use this client on tenant pages.
  const admin = createAdminClient();

  const [
    schoolRes,
    studentsRes,
    staffRes,
    generatedRes,
    printedRes,
    usersRes,
    branchesRes,
    classesRes,
    auditRes,
  ] = await Promise.all([
    admin
      .from("schools")
      .select(
        "id, name, short_name, logo_url, phone, address, academic_year, created_at, student_template_id, staff_template_id",
      )
      .eq("id", id)
      .maybeSingle(),
    admin
      .from("members")
      .select("id", { count: "exact", head: true })
      .eq("school_id", id)
      .eq("member_type", "student"),
    admin
      .from("members")
      .select("id", { count: "exact", head: true })
      .eq("school_id", id)
      .eq("member_type", "staff"),
    admin
      .from("members")
      .select("id", { count: "exact", head: true })
      .eq("school_id", id)
      .in("pipeline_status", GENERATED_ONWARD),
    admin
      .from("members")
      .select("id", { count: "exact", head: true })
      .eq("school_id", id)
      .eq("pipeline_status", "printed"),
    admin
      .from("app_users")
      .select("id", { count: "exact", head: true })
      .eq("school_id", id),
    admin
      .from("branches")
      .select("id", { count: "exact", head: true })
      .eq("school_id", id),
    admin
      .from("classes")
      .select("id", { count: "exact", head: true })
      .eq("school_id", id),
    admin
      .from("audit_log")
      .select(
        "id, action, entity_type, entity_id, created_at, actor:actor_id(full_name)",
      )
      .eq("school_id", id)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(20),
  ]);

  const school = (schoolRes.data ?? null) as SchoolDetail | null;
  if (!school) notFound();

  const audit = (auditRes.data ?? []) as unknown as AuditRow[];
  const templatesReady = Boolean(
    school.student_template_id && school.staff_template_id,
  );

  const kpis: { label: string; value: number }[] = [
    { label: "Students", value: studentsRes.count ?? 0 },
    { label: "Staff", value: staffRes.count ?? 0 },
    { label: "Cards generated", value: generatedRes.count ?? 0 },
    { label: "Cards printed", value: printedRes.count ?? 0 },
    { label: "Users", value: usersRes.count ?? 0 },
    { label: "Branches", value: branchesRes.count ?? 0 },
    { label: "Classes", value: classesRes.count ?? 0 },
  ];

  const details: { label: string; value: string }[] = [
    { label: "Phone", value: school.phone ?? "—" },
    { label: "Address", value: school.address ?? "—" },
    { label: "Academic year", value: school.academic_year ?? "—" },
    { label: "Joined", value: JOINED.format(new Date(school.created_at)) },
    {
      label: "Student template",
      value: school.student_template_id ? "Set" : "Not set",
    },
    {
      label: "Staff template",
      value: school.staff_template_id ? "Set" : "Not set",
    },
  ];

  return (
    <div>
      <AutoRefresh seconds={12} />

      <Link
        href="/platform"
        className="text-sm text-slate-500 transition-colors hover:text-slate-700"
      >
        ← Platform
      </Link>

      {/* Header */}
      <div className="mt-3 flex flex-wrap items-center gap-4">
        {school.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={school.logo_url}
            alt=""
            className="h-14 w-14 shrink-0 rounded-lg border border-slate-200 bg-white object-contain"
          />
        ) : (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
            <Building2 className="h-6 w-6" />
          </div>
        )}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold text-slate-900">{school.name}</h1>
            {school.short_name && (
              <span className="badge bg-slate-100 text-slate-600">
                {school.short_name}
              </span>
            )}
            {templatesReady ? (
              <span className="badge bg-teal-50 text-teal-700">Templates ready</span>
            ) : (
              <span className="badge bg-amber-50 text-amber-700">Templates pending</span>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Real-time overview of this tenant.
          </p>
        </div>
      </div>

      {/* KPI strip */}
      <div className="card mt-5 flex flex-wrap divide-y divide-slate-100 sm:divide-x sm:divide-y-0">
        {kpis.map((k) => (
          <div key={k.label} className="min-w-[7.5rem] flex-1 px-5 py-4">
            <div className="text-2xl font-semibold tabular-nums text-slate-900">
              {NUM.format(k.value)}
            </div>
            <div className="mt-0.5 text-xs font-medium uppercase tracking-wide text-slate-400">
              {k.label}
            </div>
          </div>
        ))}
      </div>

      {/* Details + activity */}
      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* School details */}
        <div className="card p-6">
          <h2 className="text-sm font-semibold text-slate-900">School details</h2>
          <dl className="mt-4 divide-y divide-slate-100">
            {details.map((d) => (
              <div
                key={d.label}
                className="flex items-start justify-between gap-4 py-2.5"
              >
                <dt className="shrink-0 text-sm text-slate-500">{d.label}</dt>
                <dd className="max-w-[62%] text-right text-sm font-medium text-slate-800">
                  {d.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Recent activity */}
        <div className="card p-6">
          <h2 className="text-sm font-semibold text-slate-900">Recent activity</h2>
          {audit.length === 0 ? (
            <p className="mt-4 text-sm text-slate-400">No activity recorded yet.</p>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100">
              {audit.map((row) => {
                const target = row.entity_type
                  ? `${row.entity_type}${
                      row.entity_id ? ` ${row.entity_id.slice(0, 8)}` : ""
                    }`
                  : "";
                return (
                  <li
                    key={row.id}
                    className="flex items-start justify-between gap-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-800">
                        {actionLabel(row.action)}
                      </div>
                      <div className="mt-0.5 truncate text-xs text-slate-500">
                        {row.actor?.full_name ?? "System"}
                        {target && (
                          <span className="text-slate-400"> · {target}</span>
                        )}
                      </div>
                    </div>
                    <span className="shrink-0 whitespace-nowrap text-xs text-slate-400">
                      {relativeTime(row.created_at)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
