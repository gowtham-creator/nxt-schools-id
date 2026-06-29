// Domain types mirroring supabase/migrations/0001_init.sql.
// Keep in sync with the database schema (or generate via Supabase MCP generate_typescript_types).

export type MemberType = "student" | "staff";
export type MemberStatus = "active" | "inactive" | "archived";
export type AppRole = "super_admin" | "admin" | "operator";
export type CardStatus = "pending" | "generated" | "printed" | "revoked";

export interface School {
  id: string;
  name: string;
  short_name: string | null;
  logo_url: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  academic_year: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  created_at: string;
  updated_at: string;
}

export interface AppUser {
  id: string;
  school_id: string | null;
  full_name: string | null;
  role: AppRole;
  created_at: string;
  updated_at: string;
}

export interface ClassRow {
  id: string;
  school_id: string;
  name: string;
  section: string | null;
  academic_year: string | null;
  created_at: string;
}

export interface Member {
  id: string;
  school_id: string;
  member_type: MemberType;
  identifier: string | null;
  first_name: string;
  last_name: string | null;
  photo_url: string | null;
  dob: string | null;
  gender: string | null;
  blood_group: string | null;
  class_id: string | null;
  roll_no: string | null;
  designation: string | null;
  department: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  valid_from: string | null;
  valid_until: string | null;
  status: MemberStatus;
  qr_token: string;
  extra: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type TemplateElementType =
  | "text"
  | "field"
  | "image"
  | "qr"
  | "barcode"
  | "rect";

/** A single positioned element on a card side. Coordinates are in millimetres. */
export interface TemplateElement {
  id: string;
  type: TemplateElementType;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation?: number;
  // text / field
  text?: string;
  field?: string; // member field key, e.g. "first_name"
  fontFamily?: string;
  fontSize?: number; // pt
  fontWeight?: number | string;
  color?: string;
  align?: "left" | "center" | "right";
  uppercase?: boolean;
  // image
  src?: string; // url, or binding "photo_url" | "logo"
  fit?: "cover" | "contain";
  radius?: number;
  // qr / barcode
  value?: string; // static, or binding "qr_token" | "identifier" | verify URL
  barcodeType?: string; // e.g. "code128"
  // rect / background
  fill?: string;
  borderColor?: string;
  borderWidth?: number;
}

export interface TemplateSide {
  background: string | null; // image url or solid color
  elements: TemplateElement[];
}

export interface IdTemplate {
  id: string;
  school_id: string;
  name: string;
  width_mm: number;
  height_mm: number;
  dpi: number;
  orientation: "landscape" | "portrait";
  front: TemplateSide;
  back: TemplateSide;
  is_default: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CardBatch {
  id: string;
  school_id: string;
  name: string | null;
  template_id: string | null;
  created_by: string | null;
  status: CardStatus;
  created_at: string;
}

export interface GeneratedCard {
  id: string;
  school_id: string;
  member_id: string;
  template_id: string | null;
  batch_id: string | null;
  status: CardStatus;
  pdf_url: string | null;
  generated_by: string | null;
  generated_at: string;
}

/** Public, PII-safe shape returned by the verify_card() RPC. */
export interface CardVerification {
  full_name: string;
  member_type: MemberType;
  identifier: string | null;
  photo_url: string | null;
  class_name: string | null;
  section: string | null;
  valid_until: string | null;
  status: MemberStatus;
  school_name: string;
  school_logo: string | null;
}
