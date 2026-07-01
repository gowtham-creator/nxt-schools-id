import "server-only";

// Server-side binding resolver: turns ONE template side + a member into the
// `CardSideData` map the pure `<CardSide>` renderer consumes (keyed by element.id).
//
// This is the "print"/data mode of the resolve contract (PHASE-2-3-ARCHITECTURE
// §1.3, §3.2): text/field → display strings; image → an asset URL; qr/barcode →
// `data:` URLs produced by `src/lib/codes.ts`. QR/barcode always carry an
// explicit white backing in the renderer, so they stay scannable over a coloured
// card background.

import type { Member, School, TemplateSide } from "@/lib/types";
import type { CardSideData } from "@/lib/card-render";
import { code128SvgDataUrl, qrPngDataUrl } from "@/lib/codes";

/** Flattened class info for `class_name` / `section` bindings. */
type ClassInfo = { name: string; section: string | null } | null;

/** Member columns that a `field`/`qr` element may bind to (all coerce to string). */
type MemberFieldKey =
  | "identifier"
  | "dob"
  | "blood_group"
  | "roll_no"
  | "guardian_name"
  | "guardian_phone"
  | "phone"
  | "valid_until"
  | "designation"
  | "department";

const MEMBER_FIELD_KEYS: readonly MemberFieldKey[] = [
  "identifier",
  "dob",
  "blood_group",
  "roll_no",
  "guardian_name",
  "guardian_phone",
  "phone",
  "valid_until",
  "designation",
  "department",
];

const isMemberFieldKey = (key: string): key is MemberFieldKey =>
  (MEMBER_FIELD_KEYS as readonly string[]).includes(key);

/** `[first_name, last_name].filter(Boolean).join(" ")` — the `full_name` binding. */
const fullName = (member: Member): string =>
  [member.first_name, member.last_name].filter(Boolean).join(" ");

/** Read a bound member value as a display string (nulls → ""). */
function memberValue(field: string, member: Member, classRow: ClassInfo): string {
  switch (field) {
    case "full_name":
      return fullName(member);
    case "first_name":
      return member.first_name ?? "";
    case "last_name":
      return member.last_name ?? "";
    case "class_name":
      return classRow?.name ?? "";
    case "section":
      return classRow?.section ?? "";
    default:
      return isMemberFieldKey(field) ? member[field] ?? "" : "";
  }
}

/**
 * Resolve one template side into a `CardSideData` map keyed by `element.id`.
 * The reserved `"background"` key copies the side background so the renderer can
 * inline it without cloning the side (see `CardSide`'s `data.background ?? side.background`).
 */
export async function resolveSide(
  side: TemplateSide,
  member: Member,
  classRow: ClassInfo,
  school: Partial<School>,
): Promise<CardSideData> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const data: CardSideData = {};

  for (const el of side.elements) {
    switch (el.type) {
      case "text": {
        data[el.id] = el.text ?? "";
        break;
      }

      case "field": {
        data[el.id] = el.field ? memberValue(el.field, member, classRow) : "";
        break;
      }

      case "image": {
        data[el.id] =
          el.src === "photo_url"
            ? member.photo_url ?? ""
            : el.src === "logo"
              ? school.logo_url ?? ""
              : el.src ?? "";
        break;
      }

      case "qr": {
        const value =
          el.value === "qr_token"
            ? `${appUrl}/verify/${member.qr_token}`
            : el.value
              ? memberValue(el.value, member, classRow)
              : "";
        data[el.id] = value ? await qrPngDataUrl(value, { ecLevel: el.ecLevel }) : "";
        break;
      }

      case "barcode": {
        const value = member.identifier ?? "";
        data[el.id] = value ? await code128SvgDataUrl(value) : "";
        break;
      }

      case "rect":
      default:
        // rect has no bound value; nothing to resolve.
        break;
    }
  }

  if (side.background) data.background = side.background;
  return data;
}
