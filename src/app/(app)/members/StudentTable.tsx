"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MEMBER_TYPE_LABELS } from "@/lib/constants";
import type { PipelineStatus } from "@/lib/types";
import { deleteMember } from "./actions";
import {
  generateCard,
  advanceStatus,
  bulkGenerate,
  bulkAssignTemplate,
  bulkAdvance,
} from "./card-actions";

/** Row shape built by members/page.tsx and handed to this table. */
export type MemberRow = {
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

/** Next pipeline step for the per-row "Advance" button. `printed` is terminal (omitted). */
const NEXT_STATUS: Partial<Record<PipelineStatus, PipelineStatus>> = {
  generated: "print_approval_pending",
  print_approval_pending: "sent_for_printing",
  sent_for_printing: "printed",
};

/** Statuses selectable in the bulk "Advance" dropdown. */
const ADVANCE_OPTIONS: { label: string; value: PipelineStatus }[] = [
  { label: "Generated", value: "generated" },
  { label: "Print Approval Pending", value: "print_approval_pending" },
  { label: "Sent For Printing", value: "sent_for_printing" },
  { label: "Printed", value: "printed" },
];

export default function StudentTable({
  rows,
  templates,
}: {
  rows: MemberRow[];
  templates: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [assignTemplateId, setAssignTemplateId] = useState<string>(templates[0]?.id ?? "");
  const [advanceTo, setAdvanceTo] = useState<PipelineStatus>("sent_for_printing");
  const [note, setNote] = useState<string>("");

  const allSelected = rows.length > 0 && selected.size === rows.length;

  const toggleAll = () => {
    setSelected((prev) =>
      prev.size === rows.length ? new Set() : new Set(rows.map((r) => r.id)),
    );
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  /** Runs a bulk action, then refreshes the list and clears selection. */
  const run = (fn: () => Promise<string>) => {
    startTransition(async () => {
      const message = await fn();
      setNote(message);
      setSelected(new Set());
      router.refresh();
    });
  };

  const ids = () => Array.from(selected);

  return (
    <>
      {/* Sticky bulk action bar */}
      {selected.size > 0 && (
        <div className="card sticky top-0 z-10 mt-5 flex flex-wrap items-center gap-2 p-3">
          <span className="text-sm font-medium text-slate-700">{selected.size} selected</span>

          <button
            type="button"
            disabled={pending}
            onClick={() =>
              run(async () => {
                const r = await bulkGenerate(ids());
                return `Generated ${r.ok}, failed ${r.failed}.`;
              })
            }
            className="btn-primary btn-sm"
          >
            Generate IDs
          </button>

          <div className="flex items-center gap-1">
            <select
              value={assignTemplateId}
              disabled={pending}
              onChange={(e) => setAssignTemplateId(e.target.value)}
              className="field-input w-auto"
            >
              {templates.length === 0 && <option value="">No templates</option>}
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={pending || !assignTemplateId}
              onClick={() =>
                run(async () => {
                  const r = await bulkAssignTemplate(ids(), assignTemplateId);
                  return `Template assigned to ${r.ok}.`;
                })
              }
              className="btn-secondary btn-sm"
            >
              Assign
            </button>
          </div>

          <button
            type="button"
            disabled={pending}
            onClick={() =>
              run(async () => {
                const r = await bulkAdvance(ids(), "sent_for_printing");
                return `Sent ${r.ok} for printing.`;
              })
            }
            className="btn-secondary btn-sm"
          >
            Send for printing
          </button>

          <div className="flex items-center gap-1">
            <select
              value={advanceTo}
              disabled={pending}
              onChange={(e) => setAdvanceTo(e.target.value as PipelineStatus)}
              className="field-input w-auto"
            >
              {ADVANCE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run(async () => {
                  const r = await bulkAdvance(ids(), advanceTo);
                  return `Advanced ${r.ok}.`;
                })
              }
              className="btn-secondary btn-sm"
            >
              Advance
            </button>
          </div>

          {(pending || note) && (
            <span className="text-xs text-slate-500">{pending ? "Working…" : note}</span>
          )}
        </div>
      )}

      {/* Table */}
      <div className="card mt-5 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="Select all"
                  className="cursor-pointer accent-teal-600"
                />
              </th>
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
                <td colSpan={10} className="px-4 py-10 text-center text-slate-400">
                  No members yet. Click <span className="font-medium">+ Add member</span> or import a sheet.
                </td>
              </tr>
            )}
            {rows.map((m) => {
              const badge = PIPELINE_BADGE[m.pipeline_status] ?? PIPELINE_BADGE.not_generated;
              const checked = selected.has(m.id);
              return (
                <tr key={m.id} className={checked ? "bg-slate-50" : "hover:bg-slate-50"}>
                  <td className="px-4 py-2">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleOne(m.id)}
                      aria-label={`Select ${m.first_name}`}
                      className="cursor-pointer accent-teal-600"
                    />
                  </td>
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
                        <button className="cursor-pointer text-slate-600 hover:text-slate-900">Generate</button>
                      </form>
                    ) : (
                      <>
                        <a
                          href={m.card_pdf_url ?? "#"}
                          target="_blank"
                          className="text-slate-600 hover:text-slate-900"
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
                            <button className="cursor-pointer text-slate-600 hover:text-slate-900">Advance</button>
                          </form>
                        )}
                      </>
                    )}
                    <Link href={`/members/${m.id}/edit`} className="text-slate-600 hover:text-slate-900">
                      Edit
                    </Link>
                    <form action={deleteMember.bind(null, m.id)} className="inline">
                      <button className="cursor-pointer text-red-600 hover:text-red-700">Delete</button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
