import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MEMBER_TYPE_LABELS } from "@/lib/constants";
import type { PipelineStatus } from "@/lib/types";
import { deleteMember } from "./actions";
import { generateCard, advanceStatus } from "./card-actions";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  member_type: "student" | "staff";
  identifier: string | null;
  first_name: string;
  last_name: string | null;
  photo_url: string | null;
  roll_no: string | null;
  status: string;
  pipeline_status: PipelineStatus;
  card_pdf_url: string | null;
  template_id: string | null;
  classes: { name: string; section: string | null } | null;
  id_templates: { name: string } | null;
};

/** Pipeline status tabs. `value: null` means "All" (no pipeline_status filter). */
const PIPELINE_TABS: { label: string; value: PipelineStatus | null }[] = [
  { label: "All", value: null },
  { label: "Not Generated", value: "not_generated" },
  { label: "Generated", value: "generated" },
  { label: "Print Approval Pending", value: "print_approval_pending" },
  { label: "Sent For Printing", value: "sent_for_printing" },
  { label: "Printed", value: "printed" },
];

/** Small colored badge per pipeline_status. */
const PIPELINE_BADGE: Record<PipelineStatus, { label: string; cls: string }> = {
  not_generated: { label: "Not Generated", cls: "bg-slate-100 text-slate-500" },
  generated: { label: "Generated", cls: "bg-blue-50 text-blue-700" },
  print_approval_pending: {
    label: "Print Approval Pending",
    cls: "bg-amber-50 text-amber-700",
  },
  sent_for_printing: { label: "Sent For Printing", cls: "bg-indigo-50 text-indigo-700" },
  printed: { label: "Printed", cls: "bg-emerald-50 text-emerald-700" },
};

const PIPELINE_VALUES: PipelineStatus[] = [
  "not_generated",
  "generated",
  "print_approval_pending",
  "sent_for_printing",
  "printed",
];

/** Next pipeline step for the "Advance" button. `printed` is terminal (omitted). */
const NEXT_STATUS: Partial<Record<PipelineStatus, PipelineStatus>> = {
  generated: "print_approval_pending",
  print_approval_pending: "sent_for_printing",
  sent_for_printing: "printed",
};

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
  const rows = (data ?? []) as unknown as Row[];

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
          <Link
            href="/members/import"
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Import CSV/Excel
          </Link>
          <Link
            href="/members/new"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
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
                  ? "bg-slate-900 text-white"
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
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="Search name or ID…"
          className="w-64 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
        />
        <select
          name="type"
          defaultValue={sp.type ?? ""}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">All types</option>
          <option value="student">Students</option>
          <option value="staff">Staff</option>
        </select>
        <button className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          Filter
        </button>
      </form>

      {/* Table */}
      <div className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Photo</th>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">ID</th>
              <th className="px-4 py-3 font-medium">Class</th>
              <th className="px-4 py-3 font-medium">Template</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">ID Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-slate-400">
                  No members yet. Click <span className="font-medium">+ Add member</span> or import a sheet.
                </td>
              </tr>
            )}
            {rows.map((m) => {
              const badge = PIPELINE_BADGE[m.pipeline_status] ?? PIPELINE_BADGE.not_generated;
              return (
                <tr key={m.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2">
                    {m.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.photo_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-slate-100" />
                    )}
                  </td>
                  <td className="px-4 py-2 font-medium text-slate-800">
                    {m.first_name} {m.last_name}
                  </td>
                  <td className="px-4 py-2 text-slate-600">{MEMBER_TYPE_LABELS[m.member_type]}</td>
                  <td className="px-4 py-2 text-slate-600">{m.identifier ?? "—"}</td>
                  <td className="px-4 py-2 text-slate-600">
                    {m.classes ? `${m.classes.name}${m.classes.section ? " - " + m.classes.section : ""}` : "—"}
                  </td>
                  <td className="px-4 py-2 text-slate-600">
                    {m.template_id ? m.id_templates?.name ?? "—" : "—"}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        m.status === "active"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {m.status}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${badge.cls}`}>
                      {badge.label}
                    </span>
                  </td>
                  <td className="space-x-3 px-4 py-2 text-right">
                    {m.pipeline_status === "not_generated" ? (
                      <form action={generateCard.bind(null, m.id)} className="inline">
                        <button className="text-slate-700 hover:underline">Generate</button>
                      </form>
                    ) : (
                      <>
                        <a
                          href={m.card_pdf_url ?? "#"}
                          target="_blank"
                          className="text-slate-700 hover:underline"
                        >
                          Download
                        </a>
                        {NEXT_STATUS[m.pipeline_status] && (
                          <form
                            action={advanceStatus.bind(
                              null,
                              m.id,
                              NEXT_STATUS[m.pipeline_status]!,
                            )}
                            className="inline"
                          >
                            <button className="text-slate-700 hover:underline">Advance</button>
                          </form>
                        )}
                      </>
                    )}
                    <Link href={`/members/${m.id}/edit`} className="text-slate-600 hover:underline">
                      Edit
                    </Link>
                    <form action={deleteMember.bind(null, m.id)} className="inline">
                      <button className="text-red-600 hover:underline">Delete</button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-slate-400">{rows.length} shown (max 300).</p>
    </div>
  );
}
