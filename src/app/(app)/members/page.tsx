import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import type { PipelineStatus } from "@/lib/types";
import StudentTable, { type MemberRow } from "./StudentTable";
import ExportButton from "./ExportButton";
import { uploadSchoolLogo } from "../settings/actions";

export const dynamic = "force-dynamic";

// Card generation runs as a Server Action on this page (generateCard /
// bulkGenerate render a headless-Chromium PDF, upload it, then update the row).
// bulkGenerate renders a whole selection sequentially in ONE invocation, so a
// full-school batch needs the platform maximum, not the 60s default.
export const maxDuration = 300;

/** Pipeline status tabs. `value: null` means "All" (no pipeline_status filter).
 *  `help` is the plain-language meaning shown as a tooltip + in the guide. */
const PIPELINE_TABS: { label: string; value: PipelineStatus | null; help: string }[] = [
  { label: "All", value: null, help: "Every student and staff record." },
  {
    label: "Not Generated",
    value: "not_generated",
    help: "No ID card has been made yet. Click Generate to create the card.",
  },
  {
    label: "Generated",
    value: "generated",
    help: "The ID card is created as a digital file (PDF). It's ready to review and download, but not printed on plastic yet.",
  },
  {
    label: "Print Approval Pending",
    value: "print_approval_pending",
    help: "The card is waiting for someone at the school to approve it before it goes to the printer.",
  },
  {
    label: "Sent For Printing",
    value: "sent_for_printing",
    help: "The approved card has been handed off to the card printer / vendor to be printed on plastic.",
  },
  {
    label: "Printed",
    value: "printed",
    help: "The physical plastic ID card is printed and ready to hand to the student or staff member.",
  },
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
  const { profile } = await getProfile();
  const canUploadLogo = profile.role === "admin" || profile.role === "super_admin";

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
          {canUploadLogo && (
            <details className="relative">
              <summary className="btn-secondary list-none [&::-webkit-details-marker]:hidden">
                School logo
              </summary>
              <form
                action={uploadSchoolLogo}
                className="card absolute right-0 z-20 mt-2 w-80 space-y-3 p-4 text-left shadow-lg"
              >
                <label htmlFor="logo" className="field-label">
                  School logo
                </label>
                <input
                  id="logo"
                  name="logo"
                  type="file"
                  required
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  className="block w-full cursor-pointer text-sm text-slate-600 file:mr-3 file:cursor-pointer file:rounded-lg file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-50"
                />
                <p className="field-hint">
                  PNG, JPG, SVG or WebP · max 2 MB. Appears on every generated card.
                </p>
                <button className="btn-primary btn-sm">Upload logo</button>
              </form>
            </details>
          )}
          <Link href="/members/photos" className="btn-secondary">
            Bulk Photos
          </Link>
          <Link href="/members/import" className="btn-secondary">
            Import CSV/Excel
          </Link>
          <ExportButton label="Export" />
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

      {/* Pipeline status tabs (hover/tap the ⓘ guide to see what each means) */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        {PIPELINE_TABS.map((t) => {
          const active = activeStatus === t.value;
          return (
            <Link
              key={t.label}
              href={tabHref(t.value)}
              title={t.help}
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

      {/* Plain-language guide to the card statuses, so staff aren't confused. */}
      <details className="mt-2 text-sm">
        <summary className="inline-flex cursor-pointer items-center gap-1 text-slate-500 transition-colors hover:text-slate-700">
          <span className="flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 text-[10px] font-semibold">
            i
          </span>
          What do these statuses mean?
        </summary>
        <ul className="card mt-2 max-w-2xl divide-y divide-slate-100 p-0">
          {PIPELINE_TABS.filter((t) => t.value !== null).map((t) => (
            <li key={t.label} className="flex gap-3 px-4 py-2.5">
              <span className="w-40 shrink-0 font-medium text-slate-800">{t.label}</span>
              <span className="text-slate-500">{t.help}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 max-w-2xl text-xs text-slate-400">
          Flow: a card is <span className="font-medium">Generated</span> (digital), then reviewed
          &amp; <span className="font-medium">approved</span>, then{" "}
          <span className="font-medium">sent to the printer</span>, and finally{" "}
          <span className="font-medium">Printed</span> as a physical plastic card.
        </p>
      </details>

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
