"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import { importMembers } from "./actions";

type Row = Record<string, string>;

const HEADER_ALIASES: Record<string, string[]> = {
  first_name: ["first name", "firstname", "first", "name", "student name", "staff name", "full name", "student", "person name"],
  last_name: ["last name", "lastname", "surname"],
  identifier: ["admission no", "admission number", "admission", "admno", "adm no", "admission id", "employee id", "emp id", "empno", "employee no", "id", "identifier", "reg no", "registration no", "registration number"],
  member_type: ["type", "member type", "category", "role"],
  class: ["class", "grade", "standard", "std", "class name"],
  section: ["section", "sec", "division", "div"],
  roll_no: ["roll no", "roll", "roll number", "rollno", "sl no", "serial no"],
  dob: ["dob", "date of birth", "birth date", "birthdate", "d o b"],
  gender: ["gender", "sex"],
  blood_group: ["blood group", "blood", "bloodgroup"],
  // Father's Name is the default guardian; apostrophes are stripped by norm().
  guardian_name: ["guardian", "guardian name", "parent", "parent name", "father name", "fathers name", "father", "guardian father name"],
  guardian_phone: ["guardian phone", "parent phone", "parent contact", "guardian contact", "guardian mobile", "parent mobile"],
  phone: ["phone", "mobile", "mobile no", "mobile number", "phone no", "phone number", "contact", "contact no", "contact number", "student contact"],
  email: ["email", "email id", "e mail", "mail", "email address"],
  address: ["address", "current address", "permanent address", "residential address", "home address", "student address", "addr", "address line"],
  academic_year: ["academic year", "batch", "session", "year", "academic session"],
};

// Lowercase, drop apostrophes ("Father's" -> "fathers"), collapse any other
// punctuation/whitespace (dots, underscores, dashes) to single spaces. So
// "Roll.No", "admission_number", "Father's Name" all match their aliases.
const norm = (h: string) =>
  h
    .trim()
    .toLowerCase()
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const DATE_FIELDS = new Set(["dob", "valid_until"]);
function toISODate(v: unknown): string {
  if (v == null || v === "") return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  if (v instanceof Date) return isNaN(v.getTime()) ? "" : fmt(v);
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : fmt(d);
}

function mapRows(json: Record<string, unknown>[]): Row[] {
  if (!json.length) return [];
  const cols = Object.keys(json[0]);
  const fieldFor: Record<string, string> = {};
  for (const col of cols) {
    const n = norm(col);
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      if (aliases.includes(n)) {
        fieldFor[col] = field;
        break;
      }
    }
  }
  return json.map((row) => {
    const out: Row = {};
    for (const col of cols) {
      const f = fieldFor[col];
      if (!f) continue;
      const v: unknown = row[col];
      const val = DATE_FIELDS.has(f) ? toISODate(v) : v == null ? "" : String(v).trim();
      // When two columns map to the same field (e.g. current/permanent address),
      // keep the first non-empty value.
      if (!out[f]) out[f] = val;
    }
    // A single full-name column (no separate last name) is split: first token
    // becomes the first name, the remainder the last name.
    if (out.first_name && !out.last_name && out.first_name.includes(" ")) {
      const parts = out.first_name.split(/\s+/);
      out.first_name = parts.shift() ?? out.first_name;
      out.last_name = parts.join(" ");
    }
    return out;
  });
}

export function ImportClient() {
  const [rows, setRows] = useState<Row[]>([]);
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState<{ inserted: number; failed: number; errors: string[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr("");
    setResult(null);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "", raw: false });
      const mapped = mapRows(json);
      setRows(mapped);
      setFileName(file.name);
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Could not read the file");
    }
  }

  async function doImport() {
    setBusy(true);
    try {
      setResult(await importMembers(rows));
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  function downloadTemplate() {
    const headers = ["member_type", "student_name", "admission_number", "class", "section", "academic_year", "roll_no", "date_of_birth", "gender", "blood_group", "father_name", "contact_number", "email", "address"];
    const sample = ["student", "Ravi Kumar", "NXT-2025-002", "5th", "A", "2026-27", "12", "2014-05-20", "Male", "O+", "Suresh Kumar", "9876543210", "ravi@example.com", "12-3 Main Road, Siddipet"];
    const csv = headers.join(",") + "\n" + sample.join(",") + "\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "members-template.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const preview = rows.slice(0, 8);
  const previewCols: [string, string][] = [
    ["first_name", "First name"],
    ["last_name", "Last name"],
    ["identifier", "ID"],
    ["member_type", "Type"],
    ["class", "Class"],
    ["section", "Section"],
    ["dob", "DOB"],
  ];

  return (
    <div className="max-w-3xl space-y-5">
      <div className="card p-5">
        <div className="flex flex-wrap items-center gap-3">
          <label className="btn-secondary">
            Choose CSV/Excel file
            <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={onFile} />
          </label>
          <button
            type="button"
            onClick={downloadTemplate}
            className="btn-secondary"
          >
            Download template
          </button>
          {fileName && <span className="text-sm text-slate-500">{fileName} — {rows.length} rows</span>}
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Columns are auto-matched (spaces, dots, underscores and apostrophes are handled).
          Recognised: name / student_name, admission/employee no, class, section, academic year,
          roll no, dob, gender, blood group, father/guardian, contact/phone, email, address, type.
          A single full-name column is split into first &amp; last name.
        </p>
        {err && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
      </div>

      {preview.length > 0 && (
        <div className="card overflow-hidden">
          <div className="border-b border-slate-100 px-4 py-2 text-sm font-medium text-slate-700">
            Preview (first {preview.length} of {rows.length})
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>{previewCols.map(([, label]) => <th key={label} className="px-3 py-2 font-medium">{label}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {preview.map((r, i) => (
                <tr key={i}>
                  {previewCols.map(([k]) => (
                    <td key={k} className="px-3 py-2 text-slate-700">{r[k] || "—"}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 px-4 py-3">
            <button
              onClick={doImport}
              disabled={busy}
              className="btn-primary"
            >
              {busy ? "Importing…" : `Import ${rows.length} members`}
            </button>
            <a href="/members" className="btn-secondary">Cancel</a>
          </div>
        </div>
      )}

      {result && (
        <div className="card p-5">
          <p className="text-sm">
            <span className="font-semibold text-emerald-700">{result.inserted} imported</span>
            {result.failed > 0 && <span className="ml-2 text-red-600">{result.failed} failed</span>}
          </p>
          {result.errors.length > 0 && (
            <ul className="mt-2 max-h-48 list-disc overflow-auto pl-5 text-xs text-red-600">
              {result.errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          )}
          {result.inserted > 0 && (
            <a href="/members" className="btn-primary mt-3">
              View members
            </a>
          )}
        </div>
      )}
    </div>
  );
}
