"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import { Download, FileSpreadsheet, Images } from "lucide-react";
import { getMembersForExport, type ExportRow } from "./export-actions";
import { makeZip, type ZipFile } from "./zip";

// ── Value formatters, matching the ERP import template's expected formats ──
const fullName = (r: ExportRow) => [r.first_name, r.last_name].filter(Boolean).join(" ").trim();
/** App stores dates as YYYY-MM-DD; the ERP template wants DD-MM-YYYY. */
const toDDMMYYYY = (iso: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  return m ? `${m[3]}-${m[2]}-${m[1]}` : iso || "";
};
/** Normalise gender to the ERP's "Male" / "Female" (pass anything else through). */
const normGender = (g: string): string => {
  const t = (g || "").trim().toLowerCase();
  if (t.startsWith("m")) return "Male";
  if (t.startsWith("f")) return "Female";
  return g || "";
};
/** Student contact = guardian's phone, falling back to the student's own. */
const contactNo = (r: ExportRow) => r.guardian_phone || r.phone || "";
/** Normalise academic year to the ERP's full "YYYY-YYYY" (e.g. 2026-27 → 2026-2027). */
const normYear = (y: string): string => {
  const m = /^(\d{4})\s*-\s*(\d{2}|\d{4})$/.exec((y || "").trim());
  if (!m) return y || "";
  const end = m[2].length === 2 ? m[1].slice(0, 2) + m[2] : m[2];
  return `${m[1]}-${end}`;
};

/**
 * Columns EXACTLY match the ERP "student_import_template.xlsx" — same headers,
 * same order, same formats — so a school can feed this export straight into the
 * ERP with no rework. Fields the ID-card app doesn't hold are left blank (never
 * fabricated). Each column pulls its value live from the member record.
 */
const COLUMNS: { header: string; get: (r: ExportRow, i: number) => string }[] = [
  { header: "Sl No", get: (_r, i) => String(i + 1) },
  { header: "Admission Number *", get: (r) => r.identifier },
  { header: "Student Name *", get: (r) => fullName(r) },
  { header: "Date of Birth * (DD-MM-YYYY)", get: (r) => toDDMMYYYY(r.dob) },
  { header: "Gender * (Male/Female)", get: (r) => normGender(r.gender) },
  { header: "Class *", get: (r) => r.class },
  { header: "Section *", get: (r) => r.section },
  { header: "Academic Year *", get: (r) => normYear(r.academic_year) },
  { header: "Admission Date (DD-MM-YYYY)", get: () => "" },
  { header: "Father Name", get: (r) => r.guardian_name },
  { header: "Mother Name", get: () => "" },
  { header: "Current Address", get: (r) => r.address },
  { header: "Permanent Address", get: () => "" },
  { header: "Contact Number *", get: (r) => contactNo(r) },
  { header: "Roll Number", get: (r) => r.roll_no },
  { header: "Email", get: (r) => r.email },
  { header: "Category", get: () => "" },
  { header: "Religion", get: () => "" },
  { header: "Caste", get: () => "" },
  { header: "Blood Group (e.g. O+)", get: (r) => r.blood_group },
  { header: "Student House", get: () => "" },
  { header: "Height", get: () => "" },
  { header: "Weight", get: () => "" },
  { header: "UID (Aadhar No)", get: () => "" },
  { header: "PEN Number", get: () => "" },
  { header: "Mother Tongue", get: () => "" },
  { header: "Identification Marks", get: () => "" },
  { header: "Previous School", get: () => "" },
  { header: "Old Admission Number", get: () => "" },
  { header: "Father Education Qualification", get: () => "" },
  { header: "Mother Education Qualification", get: () => "" },
  { header: "Father Aadhaar Number", get: () => "" },
  { header: "Mother Aadhaar Number", get: () => "" },
  { header: "Father Occupation", get: () => "" },
  { header: "Mother Occupation", get: () => "" },
  { header: "Bus Transport Required (Yes/No)", get: () => "" },
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

/** Build the ERP-format "Students" spreadsheet (one row per student). */
function buildWorkbook(rows: ExportRow[]): Uint8Array {
  const aoa = [
    COLUMNS.map((c) => c.header),
    ...rows.map((r, i) => COLUMNS.map((c) => c.get(r, i))),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  // Sheet name must be "Students" — the ERP import looks for that sheet.
  XLSX.utils.book_append_sheet(wb, ws, "Students");
  // XLSX.write with type:"array" returns an ArrayBuffer — wrap it so the zip
  // builder (and Blob) get a real Uint8Array with a valid .length.
  return new Uint8Array(XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer);
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
  const [progress, setProgress] = useState("");

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
      download(new Blob([buildWorkbook(rows)] as BlobPart[]), `students-${stamp}.xlsx`);
    } catch {
      setNote("Export failed.");
    } finally {
      setBusy("");
    }
  }

  async function exportZip() {
    setBusy("zip");
    setNote("");
    setProgress("");
    try {
      const rows = await getMembersForExport(ids);
      if (!rows.length) {
        setNote("No members to export.");
        return;
      }
      const used = new Set<string>();
      const files: ZipFile[] = [];
      const withPhotos = rows.filter((r) => r.photo_url);
      let done = 0;
      let ok = 0;

      // Fetch photos with bounded concurrency (a worker pool), each with a
      // timeout, so a big school's export finishes in seconds instead of
      // stalling on hundreds of one-at-a-time round trips.
      const CONCURRENCY = 12;
      let idx = 0;
      async function worker() {
        while (idx < withPhotos.length) {
          const r = withPhotos[idx++];
          try {
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), 20000);
            const resp = await fetch(r.photo_url, { signal: ctrl.signal });
            clearTimeout(timer);
            if (resp.ok) {
              const bytes = new Uint8Array(await resp.arrayBuffer());
              const name = photoName(r, used);
              files.push({ name: `photos/${name}`, data: bytes });
              ok++;
            }
          } catch {
            /* skip a photo that won't fetch in time */
          }
          done++;
          if (done % 5 === 0 || done === withPhotos.length) {
            setProgress(`Bundling photos… ${done}/${withPhotos.length}`);
          }
        }
      }
      await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

      setProgress("Building file…");
      files.unshift({ name: `students-${stamp}.xlsx`, data: buildWorkbook(rows) });
      download(makeZip(files), `students-${stamp}.zip`);
      setNote(`Exported ${rows.length} students${ok ? ` + ${ok} photos` : ""}.`);
    } catch {
      setNote("Export failed.");
    } finally {
      setBusy("");
      setProgress("");
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
          {busy === "zip" ? progress || "Preparing…" : "ZIP (with photos)"}
        </button>
        {note && <p className="px-3 py-1 text-xs text-slate-500">{note}</p>}
      </div>
    </details>
  );
}
