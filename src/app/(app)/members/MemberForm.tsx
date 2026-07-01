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

const inputCls =
  "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900";
const labelCls = "block text-sm font-medium text-slate-700";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
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
      <div className="inline-flex rounded-md border border-slate-300 p-0.5 text-sm">
        {(["student", "staff"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={`rounded px-4 py-1.5 capitalize ${
              type === t ? "bg-slate-900 text-white" : "text-slate-600"
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
          <Field label="First name *">
            <input name="first_name" required defaultValue={member?.first_name ?? ""} className={inputCls} />
          </Field>
          <Field label="Last name">
            <input name="last_name" defaultValue={member?.last_name ?? ""} className={inputCls} />
          </Field>
          <Field label={type === "student" ? "Admission No" : "Employee ID"}>
            <input name="identifier" defaultValue={member?.identifier ?? ""} className={inputCls} />
          </Field>
          <Field label="Status">
            <select name="status" defaultValue={member?.status ?? "active"} className={inputCls}>
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
            <Field label="Class">
              <select name="class_id" defaultValue={member?.class_id ?? ""} className={inputCls}>
                <option value="">— none —</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.section ? ` - ${c.section}` : ""}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Roll No">
              <input name="roll_no" defaultValue={member?.roll_no ?? ""} className={inputCls} />
            </Field>
          </>
        ) : (
          <>
            <Field label="Designation">
              <input name="designation" defaultValue={member?.designation ?? ""} className={inputCls} />
            </Field>
            <Field label="Department">
              <input name="department" defaultValue={member?.department ?? ""} className={inputCls} />
            </Field>
          </>
        )}
        <Field label="Date of birth">
          <input type="date" name="dob" defaultValue={member?.dob ?? ""} className={inputCls} />
        </Field>
        <Field label="Gender">
          <select name="gender" defaultValue={member?.gender ?? ""} className={inputCls}>
            <option value="">—</option>
            {GENDERS.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </Field>
        <Field label="Blood group">
          <select name="blood_group" defaultValue={member?.blood_group ?? ""} className={inputCls}>
            <option value="">—</option>
            {BLOOD_GROUPS.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </Field>
        <Field label="Valid until">
          <input type="date" name="valid_until" defaultValue={member?.valid_until ?? ""} className={inputCls} />
        </Field>
      </div>

      {/* Contact / guardian */}
      <div className="grid grid-cols-3 gap-4">
        <Field label="Guardian name">
          <input name="guardian_name" defaultValue={member?.guardian_name ?? ""} className={inputCls} />
        </Field>
        <Field label="Guardian phone">
          <input name="guardian_phone" defaultValue={member?.guardian_phone ?? ""} className={inputCls} />
        </Field>
        <Field label="Phone">
          <input name="phone" defaultValue={member?.phone ?? ""} className={inputCls} />
        </Field>
        <Field label="Email">
          <input type="email" name="email" defaultValue={member?.email ?? ""} className={inputCls} />
        </Field>
        <div className="col-span-2">
          <Field label="Address">
            <input name="address" defaultValue={member?.address ?? ""} className={inputCls} />
          </Field>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          className="rounded-md bg-slate-900 px-5 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {submitLabel}
        </button>
        <a href="/members" className="rounded-md border border-slate-300 px-5 py-2 text-sm text-slate-700 hover:bg-slate-50">
          Cancel
        </a>
      </div>
    </form>
  );
}
