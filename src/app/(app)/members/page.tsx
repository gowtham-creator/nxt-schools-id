import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { PipelineStatus } from "@/lib/types";
import StudentTable, { type MemberRow } from "./StudentTable";

export const dynamic = "force-dynamic";

// Card generation runs as a Server Action on this page (generateCard /
// bulkGenerate render a headless-Chromium PDF, upload it, then update the row).
// bulkGenerate renders a whole selection sequentially in ONE invocation, so a
// full-school batch needs the platform maximum, not the 60s default.
export const maxDuration = 300;

/** Pipeline status tabs. `value: null` means "All" (no pipeline_status filter). */
const PIPELINE_TABS: { label: string; value: PipelineStatus | null }[] = [
  { label: "All", value: null },
  { label: "Not Generated", value: "not_generated" },
  { label: "Generated", value: "generated" },
  { label: "Print Approval Pending", value: "print_approval_pending" },
  { label: "Sent For Printing", value: "sent_for_printing" },
  { label: "Printed", value: "printed" },
];

const PIPELINE_VALUES: PipelineStatus[] = [
  "not_generated",
  "generated",
  "print_approval_pending",
  "sent_for_printing",
  "printed",
];

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    type?: string;
    status?: string;
    ok?: string;
    error?: string;
  }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();

  const activeStatus: PipelineStatus | null = PIPELINE_VALUES.includes(
    sp.status as PipelineStatus,
  )
    ? (sp.status as PipelineStatus)
    : null;

  let query = supabase
    .from("members")
    .select(
      "id,member_type,identifier,first_name,last_name,photo_url,roll_no,status,pipeline_status,card_pdf_url,template_id,classes(name,section),id_templates(name)",
    )
    .order("created_at", { ascending: false })
    .limit(300);

  if (sp.q) {
    const q = sp.q.replace(/[%,]/g, "");
    query = query.or(
      `first_name.ilike.%${q}%,last_name.ilike.%${q}%,identifier.ilike.%${q}%`,
    );
  }
  if (sp.type === "student" || sp.type === "staff") query = query.eq("member_type", sp.type);
  if (activeStatus) query = query.eq("pipeline_status", activeStatus);

  const { data, error } = await query;
  const rows = (data ?? []) as unknown as MemberRow[];

  // Templates for the bulk "Assign template" dropdown.
  const { data: templateData } = await supabase
    .from("id_templates")
    .select("id,name")
    .order("name", { ascending: true });
  const templates = (templateData ?? []) as { id: string; name: string }[];

  // Build a tab href that preserves the current q/type filters.
  const tabHref = (value: PipelineStatus | null): string => {
    const params = new URLSearchParams();
    if (sp.q) params.set("q", sp.q);
    if (sp.type) params.set("type", sp.type);
    if (value) params.set("status", value);
    const qs = params.toString();
    return qs ? `/members?${qs}` : "/members";
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Members</h1>
          <p className="mt-1 text-sm text-slate-500">Students &amp; staff records.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/members/photos" className="btn-secondary">
            Bulk Photos
          </Link>
          <Link href="/members/import" className="btn-secondary">
            Import CSV/Excel
          </Link>
          <Link href="/members/new" className="btn-primary">
            + Add member
          </Link>
        </div>
      </div>

      {sp.ok && (
        <p className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{sp.ok}</p>
      )}
      {(sp.error || error) && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {sp.error || error?.message}
        </p>
      )}

      {/* Pipeline status tabs */}
      <div className="mt-5 flex flex-wrap gap-2">
        {PIPELINE_TABS.map((t) => {
          const active = activeStatus === t.value;
          return (
            <Link
              key={t.label}
              href={tabHref(t.value)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                active
                  ? "bg-teal-700 text-white"
                  : "border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      {/* Search / filter */}
      <form className="mt-3 flex flex-wrap gap-2">
        {activeStatus && <input type="hidden" name="status" value={activeStatus} />}
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={sp.q ?? ""}
          placeholder="Search name or ID…"
          className="field-input w-64"
        />
        <select
          id="type"
          name="type"
          defaultValue={sp.type ?? ""}
          className="field-input w-auto"
        >
          <option value="">All types</option>
          <option value="student">Students</option>
          <option value="staff">Staff</option>
        </select>
        <button className="btn-secondary">
          Filter
        </button>
      </form>

      {/* Table (with bulk operations) */}
      <StudentTable rows={rows} templates={templates} />
      <p className="mt-2 text-xs text-slate-400">{rows.length} shown (max 300).</p>
    </div>
  );
}
