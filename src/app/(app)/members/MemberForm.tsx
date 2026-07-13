"use client";

import { useState } from "react";
import { BLOOD_GROUPS, GENDERS, SECTIONS, gradeRank } from "@/lib/constants";
import type { ClassRow, Member } from "@/lib/types";
import { PhotoField } from "./PhotoField";

/** Serializable academic-year option for the Batch dropdown. */
export type AcademicYearOption = { id: string; name: string; is_current?: boolean };
/** Serializable branch option for the Branch dropdown. */
export type BranchOption = { id: string; name: string };

type Props = {
  action: (formData: FormData) => void | Promise<void>;
  classes: ClassRow[];
  academicYears?: AcademicYearOption[];
  branches?: BranchOption[];
  member?: Partial<Member>;
  submitLabel?: string;
};

const inputCls = "field-input";
const labelCls = "field-label";

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className={labelCls}>
        {label}
      </label>
      {children}
    </div>
  );
}

export function MemberForm({
  action,
  classes,
  academicYears = [],
  branches = [],
  member,
  submitLabel = "Save member",
}: Props) {
  const [type, setType] = useState<"student" | "staff">(member?.member_type ?? "student");

  // Distinct grade names for the "Class / Grade" select, ordered on the standard
  // ladder (Nursery → 12th) via gradeRank; unknowns sort last, then alphabetical.
  const gradeNames = [...new Set(classes.map((c) => c.name))].sort(
    (a, b) => gradeRank(a) - gradeRank(b) || a.localeCompare(b),
  );

  // In edit mode, split the member's saved class_id back into grade + section
  // so the two selects default to the right values.
  const currentClass = member?.class_id
    ? classes.find((c) => c.id === member.class_id)
    : undefined;
  const defaultGrade = currentClass?.name ?? "";
  const defaultSection = currentClass?.section ?? "";

  // Batch defaults to the member's saved year, else the school's current year.
  const currentYear = academicYears.find((y) => y.is_current);
  const defaultYearId = member?.academic_year_id ?? currentYear?.id ?? "";

  return (
    <form action={action} className="max-w-3xl space-y-6">
      <input type="hidden" name="member_type" value={type} />

      {/* Type toggle */}
      <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 text-sm shadow-sm">
        {(["student", "staff"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={`cursor-pointer rounded-md px-4 py-1.5 font-medium capitalize transition-colors duration-150 ${
              type === t ? "bg-teal-700 text-white" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Photo + core */}
      <div className="flex flex-col gap-6 sm:flex-row">
        <PhotoField initialUrl={member?.photo_url ?? null} memberId={member?.id ?? null} />

        <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="First name *" htmlFor="first_name">
            <input id="first_name" name="first_name" required defaultValue={member?.first_name ?? ""} className={inputCls} />
          </Field>
          <Field label="Last name" htmlFor="last_name">
            <input id="last_name" name="last_name" defaultValue={member?.last_name ?? ""} className={inputCls} />
          </Field>
          <Field label={type === "student" ? "Admission No" : "Employee ID"} htmlFor="identifier">
            <input id="identifier" name="identifier" defaultValue={member?.identifier ?? ""} className={inputCls} />
          </Field>
          <Field label="Status" htmlFor="status">
            <select id="status" name="status" defaultValue={member?.status ?? "active"} className={inputCls}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="archived">Archived</option>
            </select>
          </Field>
        </div>
      </div>

      {/* Type-specific */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {branches.length > 0 && (
          <Field label="Branch / Campus" htmlFor="branch_id">
            <select id="branch_id" name="branch_id" defaultValue={member?.branch_id ?? ""} className={inputCls}>
              <option value="">— Select branch —</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        {type === "student" ? (
          <>
            <Field label="Class / Grade" htmlFor="class_grade">
              <select id="class_grade" name="class_grade" defaultValue={defaultGrade} className={inputCls}>
                <option value="">— Select grade —</option>
                {gradeNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Section (optional)" htmlFor="class_section">
              <select id="class_section" name="class_section" defaultValue={defaultSection} className={inputCls}>
                <option value="">— none —</option>
                {SECTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Roll No" htmlFor="roll_no">
              <input id="roll_no" name="roll_no" defaultValue={member?.roll_no ?? ""} className={inputCls} />
            </Field>
            <Field label="Batch (Academic year)" htmlFor="academic_year_id">
              <select
                id="academic_year_id"
                name="academic_year_id"
                defaultValue={defaultYearId}
                className={inputCls}
              >
                <option value="">— Select batch —</option>
                {academicYears.map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.name}
                    {y.is_current ? " (current)" : ""}
                  </option>
                ))}
              </select>
            </Field>
          </>
        ) : (
          <>
            <Field label="Designation" htmlFor="designation">
              <input id="designation" name="designation" defaultValue={member?.designation ?? ""} className={inputCls} />
            </Field>
            <Field label="Department" htmlFor="department">
              <input id="department" name="department" defaultValue={member?.department ?? ""} className={inputCls} />
            </Field>
          </>
        )}
        <Field label="Date of birth" htmlFor="dob">
          <input type="date" id="dob" name="dob" defaultValue={member?.dob ?? ""} className={inputCls} />
        </Field>
        <Field label="Gender" htmlFor="gender">
          <select id="gender" name="gender" defaultValue={member?.gender ?? ""} className={inputCls}>
            <option value="">—</option>
            {GENDERS.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </Field>
        <Field label="Blood group" htmlFor="blood_group">
          <select id="blood_group" name="blood_group" defaultValue={member?.blood_group ?? ""} className={inputCls}>
            <option value="">—</option>
            {BLOOD_GROUPS.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </Field>
        <Field label="Valid until" htmlFor="valid_until">
          <input type="date" id="valid_until" name="valid_until" defaultValue={member?.valid_until ?? ""} className={inputCls} />
        </Field>
      </div>

      {/* Contact / guardian */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Guardian name" htmlFor="guardian_name">
          <input id="guardian_name" name="guardian_name" defaultValue={member?.guardian_name ?? ""} className={inputCls} />
        </Field>
        <Field label="Guardian phone" htmlFor="guardian_phone">
          <input type="tel" id="guardian_phone" name="guardian_phone" defaultValue={member?.guardian_phone ?? ""} className={inputCls} />
        </Field>
        <Field label="Phone" htmlFor="phone">
          <input type="tel" id="phone" name="phone" defaultValue={member?.phone ?? ""} className={inputCls} />
        </Field>
        <Field label="Email" htmlFor="email">
          <input type="email" id="email" name="email" defaultValue={member?.email ?? ""} className={inputCls} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Address" htmlFor="address">
            <input id="address" name="address" defaultValue={member?.address ?? ""} className={inputCls} />
          </Field>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button type="submit" className="btn-primary">
          {submitLabel}
        </button>
        <a href="/members" className="btn-secondary">
          Cancel
        </a>
      </div>
    </form>
  );
}
