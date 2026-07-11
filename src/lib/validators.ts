import { z } from "zod";

/** Treat empty strings (from HTML form inputs) as null. */
const emptyToNull = (v: unknown) => (v === "" || v === undefined ? null : v);
const dateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .nullable();

export const memberSchema = z.object({
  member_type: z.enum(["student", "staff"]).default("student"),
  identifier: z.preprocess(emptyToNull, z.string().trim().max(60).nullable()),
  first_name: z.string().trim().min(1, "First name is required").max(80),
  last_name: z.preprocess(emptyToNull, z.string().trim().max(80).nullable()),
  class_id: z.preprocess(emptyToNull, z.string().uuid().nullable()),
  academic_year_id: z.preprocess(emptyToNull, z.string().uuid().nullable()),
  branch_id: z.preprocess(emptyToNull, z.string().uuid().nullable()),
  roll_no: z.preprocess(emptyToNull, z.string().trim().max(40).nullable()),
  designation: z.preprocess(emptyToNull, z.string().trim().max(80).nullable()),
  department: z.preprocess(emptyToNull, z.string().trim().max(80).nullable()),
  dob: z.preprocess(emptyToNull, dateStr),
  gender: z.preprocess(emptyToNull, z.string().max(20).nullable()),
  blood_group: z.preprocess(emptyToNull, z.string().max(5).nullable()),
  guardian_name: z.preprocess(emptyToNull, z.string().trim().max(120).nullable()),
  guardian_phone: z.preprocess(emptyToNull, z.string().trim().max(30).nullable()),
  phone: z.preprocess(emptyToNull, z.string().trim().max(30).nullable()),
  email: z.preprocess(emptyToNull, z.string().email("Invalid email").nullable()),
  address: z.preprocess(emptyToNull, z.string().trim().max(300).nullable()),
  valid_until: z.preprocess(emptyToNull, dateStr),
  status: z.enum(["active", "inactive", "archived"]).default("active"),
  photo_url: z.preprocess(emptyToNull, z.string().url().nullable()),
});

export type MemberInput = z.infer<typeof memberSchema>;

export const classSchema = z.object({
  name: z.string().trim().min(1, "Class name is required").max(60),
  section: z.preprocess(emptyToNull, z.string().trim().max(20).nullable()),
  academic_year: z.preprocess(emptyToNull, z.string().trim().max(20).nullable()),
});

export const academicYearSchema = z.object({
  name: z.string().trim().min(1, "Year name is required").max(40),
  start_date: z.preprocess(emptyToNull, dateStr),
  end_date: z.preprocess(emptyToNull, dateStr),
  // Unchecked checkboxes are absent from FormData -> undefined -> false.
  is_current: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
});

export type AcademicYearInput = z.infer<typeof academicYearSchema>;

/** Build a plain object from FormData string entries for schema parsing. */
export function formToObject(fd: FormData): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  for (const [k, v] of fd.entries()) if (typeof v === "string") o[k] = v;
  return o;
}
