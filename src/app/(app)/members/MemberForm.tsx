"use client";

import { useState } from "react";
import { BLOOD_GROUPS, GENDERS } from "@/lib/constants";
import type { ClassRow, Member } from "@/lib/types";
import { PhotoField } from "./PhotoField";

type Props = {
  action: (formData: FormData) => void | Promise<void>;
  classes: ClassRow[];
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

export function MemberForm({ action, classes, member, submitLabel = "Save member" }: Props) {
  const [type, setType] = useState<"student" | "staff">(member?.member_type ?? "student");

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
      <div className="flex gap-6">
        <PhotoField initialUrl={member?.photo_url ?? null} />

        <div className="grid flex-1 grid-cols-2 gap-4">
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
      <div className="grid grid-cols-3 gap-4">
        {type === "student" ? (
          <>
            <Field label="Class" htmlFor="class_id">
              <select id="class_id" name="class_id" defaultValue={member?.class_id ?? ""} className={inputCls}>
                <option value="">— none —</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.section ? ` - ${c.section}` : ""}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Roll No" htmlFor="roll_no">
              <input id="roll_no" name="roll_no" defaultValue={member?.roll_no ?? ""} className={inputCls} />
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
      <div className="grid grid-cols-3 gap-4">
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
        <div className="col-span-2">
          <Field label="Address" htmlFor="address">
            <input id="address" name="address" defaultValue={member?.address ?? ""} className={inputCls} />
          </Field>
        </div>
      </div>

      <div className="flex gap-3">
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
