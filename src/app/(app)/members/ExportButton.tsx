"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import { Download, FileSpreadsheet, Images } from "lucide-react";
import { getMembersForExport, type ExportRow } from "./export-actions";
import { makeZip, type ZipFile } from "./zip";

/** Column order + human headers for the exported spreadsheet. */
const COLUMNS: [keyof ExportRow, string][] = [
  ["member_type", "Type"],
  ["identifier", "Admission/Employee No"],
  ["first_name", "First name"],
  ["last_name", "Last name"],
  ["class", "Class"],
  ["section", "Section"],
  ["academic_year", "Academic year"],
  ["branch", "Branch"],
  ["roll_no", "Roll no"],
  ["designation", "Designation"],
  ["department", "Department"],
  ["dob", "Date of birth"],
  ["gender", "Gender"],
  ["blood_group", "Blood group"],
  ["guardian_name", "Guardian"],
  ["guardian_phone", "Guardian phone"],
  ["phone", "Phone"],
  ["email", "Email"],
  ["address", "Address"],
  ["status", "Status"],
  ["id_status", "ID status"],
  ["photo_url", "Photo file"],
];

function sanitize(s: string): string {
  return s.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "") || "member";
}

/** Photo filename for a member (identifier → roll → name), de-duplicated. */
function photoName(r: ExportRow, used: Set<string>): string {
  const base = sanitize(
    r.identifier || r.roll_no || [r.first_name, r.last_name].filter(Boolean).join("_") || "member",
  );
  let name = `${base}.jpg`;
  let i = 2;
  while (used.has(name.toLowerCase())) name = `${base}_${i++}.jpg`;
  used.add(name.toLowerCase());
  return name;
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Build the members spreadsheet; `photoFilenames` maps row→its photo file in the zip. */
function buildWorkbook(rows: ExportRow[], photoFilenames?: Map<ExportRow, string>): Uint8Array {
  const aoa = [
    COLUMNS.map(([, label]) => label),
    ...rows.map((r) =>
      COLUMNS.map(([key]) =>
        key === "photo_url" ? (photoFilenames?.get(r) ?? (r.photo_url ? "yes" : "")) : r[key],
      ),
    ),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Members");
  return XLSX.write(wb, { type: "array", bookType: "xlsx" }) as Uint8Array;
}

/**
 * Export members (all, or the given selected ids) to an Excel sheet, optionally
 * bundled in a ZIP together with each member's photo. Runs entirely in the
 * browser: fetches the data, builds the file, downloads it.
 */
export default function ExportButton({
  ids,
  label = "Export",
}: {
  ids?: string[];
  label?: string;
}) {
  const [busy, setBusy] = useState<"" | "xlsx" | "zip">("");
  const [note, setNote] = useState("");

  const stamp = new Date().toISOString().slice(0, 10);

  async function exportExcel() {
    setBusy("xlsx");
    setNote("");
    try {
      const rows = await getMembersForExport(ids);
      if (!rows.length) {
        setNote("No members to export.");
        return;
      }
      download(new Blob([buildWorkbook(rows)] as BlobPart[]), `members-${stamp}.xlsx`);
    } catch {
      setNote("Export failed.");
    } finally {
      setBusy("");
    }
  }

  async function exportZip() {
    setBusy("zip");
    setNote("");
    try {
      const rows = await getMembersForExport(ids);
      if (!rows.length) {
        setNote("No members to export.");
        return;
      }
      const used = new Set<string>();
      const photoFilenames = new Map<ExportRow, string>();
      const files: ZipFile[] = [];
      let withPhoto = 0;

      for (const r of rows) {
        if (!r.photo_url) continue;
        try {
          const resp = await fetch(r.photo_url);
          if (!resp.ok) continue;
          const bytes = new Uint8Array(await resp.arrayBuffer());
          const name = photoName(r, used);
          photoFilenames.set(r, name);
          files.push({ name: `photos/${name}`, data: bytes });
          withPhoto++;
        } catch {
          /* skip a photo that won't fetch */
        }
      }

      files.unshift({ name: `members-${stamp}.xlsx`, data: buildWorkbook(rows, photoFilenames) });
      download(makeZip(files), `members-${stamp}.zip`);
      setNote(`Exported ${rows.length} members${withPhoto ? ` + ${withPhoto} photos` : ""}.`);
    } catch {
      setNote("Export failed.");
    } finally {
      setBusy("");
    }
  }

  return (
    <details className="group/export relative">
      <summary className="btn-secondary btn-sm inline-flex cursor-pointer list-none items-center gap-1.5 [&::-webkit-details-marker]:hidden">
        <Download className="h-4 w-4" />
        {label}
      </summary>
      <div className="card absolute right-0 z-20 mt-2 w-64 space-y-1 p-2 text-left shadow-lg">
        <button
          type="button"
          disabled={!!busy}
          onClick={exportExcel}
          className="flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <FileSpreadsheet className="h-4 w-4 text-slate-400" />
          {busy === "xlsx" ? "Preparing…" : "Excel spreadsheet"}
        </button>
        <button
          type="button"
          disabled={!!busy}
          onClick={exportZip}
          className="flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <Images className="h-4 w-4 text-slate-400" />
          {busy === "zip" ? "Bundling photos…" : "ZIP (with photos)"}
        </button>
        {note && <p className="px-3 py-1 text-xs text-slate-500">{note}</p>}
      </div>
    </details>
  );
}
