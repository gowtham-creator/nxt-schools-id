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
  { key: "valid_until", label: "Valid until" },
] as const;

export const GENDERS = ["Male", "Female", "Other"] as const;
export const BLOOD_GROUPS = [
  "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-",
] as const;
