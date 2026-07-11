import type { AppRole, MemberType } from "@/lib/types";

const MM_PER_INCH = 25.4;

/** Standard CR80 ID card (the credit-card size used by PVC card printers). */
export const CARD_CR80 = {
  widthMm: 85.6,
  heightMm: 54,
  dpi: 300,
  widthPx: Math.round((85.6 / MM_PER_INCH) * 300), // 1011
  heightPx: Math.round((54 / MM_PER_INCH) * 300), // 638
} as const;

/** A4 sheet for ganged printing (mm). */
export const SHEET_A4 = { widthMm: 210, heightMm: 297 } as const;

export const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  operator: "Operator",
};

export const MEMBER_TYPE_LABELS: Record<MemberType, string> = {
  student: "Student",
  staff: "Staff",
};

/** Member fields that can be bound to a text element in the card designer. */
export const BINDABLE_FIELDS = [
  { key: "first_name", label: "First name" },
  { key: "last_name", label: "Last name" },
  { key: "full_name", label: "Full name" },
  { key: "identifier", label: "Admission / Emp. No" },
  { key: "class_name", label: "Class" },
  { key: "section", label: "Section" },
  { key: "roll_no", label: "Roll No" },
  { key: "designation", label: "Designation" },
  { key: "department", label: "Department" },
  { key: "dob", label: "Date of birth" },
  { key: "blood_group", label: "Blood group" },
  { key: "guardian_name", label: "Guardian" },
  { key: "guardian_phone", label: "Guardian phone" },
  { key: "phone", label: "Phone" },
  { key: "address", label: "Address" },
  { key: "valid_until", label: "Valid until" },
  { key: "school_name", label: "School name" },
  { key: "school_address", label: "School address" },
  { key: "school_phone", label: "School phone" },
] as const;

export const GENDERS = ["Male", "Female", "Other"] as const;
export const BLOOD_GROUPS = [
  "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-",
] as const;

/** Class sections (A–H) offered in the member form's Section dropdown. */
export const SECTIONS = ["A", "B", "C", "D", "E", "F", "G", "H"] as const;

/**
 * The standard school grade ladder (India), in display order. Seeded as
 * `classes` for every school so the Class dropdown is populated on day one.
 */
export const STANDARD_GRADES = [
  "Nursery",
  "LKG",
  "UKG",
  "1st",
  "2nd",
  "3rd",
  "4th",
  "5th",
  "6th",
  "7th",
  "8th",
  "9th",
  "10th",
  "11th",
  "12th",
] as const;

const GRADE_RANK = new Map<string, number>(
  STANDARD_GRADES.map((g, i) => [g.toLowerCase(), i]),
);

/** Rank a class name against the standard ladder; unknowns sort last. */
export function gradeRank(name: string): number {
  return GRADE_RANK.get(name.trim().toLowerCase()) ?? 999;
}

/** Order classes by grade (Nursery → 12th), then name, then section. */
export function sortClasses<T extends { name: string; section?: string | null }>(
  rows: T[],
): T[] {
  return [...rows].sort((a, b) => {
    const ra = gradeRank(a.name);
    const rb = gradeRank(b.name);
    if (ra !== rb) return ra - rb;
    if (a.name !== b.name) return a.name.localeCompare(b.name);
    return (a.section ?? "").localeCompare(b.section ?? "");
  });
}
