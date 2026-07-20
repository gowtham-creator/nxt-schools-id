// Designer geometry + factories + preview data (Phase 2).
// mm is the source of truth everywhere; DISPLAY_K is px-per-mm in the editor.
import { CARD_CR80 } from "@/lib/constants";
import type {
  TemplateElement,
  TemplateElementType,
  TemplateSide,
} from "@/lib/types";
import type { CardSideData } from "@/lib/card-render";

export const DISPLAY_K = 7; // px per mm in the editor canvas (~599x378 for CR80)
export const CARD = CARD_CR80;

export const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));
export const snap = (mm: number) => Math.round(mm * 10) / 10; // 0.1mm grid

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `el_${Math.round(Math.random() * 1e9)}`;

export function newElement(type: TemplateElementType): TemplateElement {
  const base: TemplateElement = { id: uid(), type, x: 6, y: 6, w: 30, h: 10, rotation: 0 };
  switch (type) {
    case "text":
      return { ...base, text: "Text", fontSize: 10, color: "#0f172a", align: "left", fontWeight: 400 };
    case "field":
      return { ...base, field: "first_name", fontSize: 10, color: "#0f172a", align: "left", fontWeight: 600 };
    case "image":
      return { ...base, w: 24, h: 30, src: "photo_url", fit: "cover", radius: 1 };
    case "qr":
      return { ...base, w: 20, h: 20, value: "qr_token", ecLevel: "M" };
    case "barcode":
      return { ...base, w: 40, h: 12, value: "identifier", barcodeType: "code128" };
    case "rect":
      return { ...base, w: 40, h: 8, fill: "#1e3a8a", radius: 0 };
    default:
      return base;
  }
}

export function blankSide(bg = "#ffffff"): TemplateSide {
  return { background: bg, elements: [] };
}

/** Demo values so the editor/thumbnails look real before a member is chosen. */
export const SAMPLE_DATA: Record<string, string> = {
  first_name: "Ananya",
  last_name: "Sharma",
  full_name: "Ananya Sharma",
  identifier: "NXT-2025-001",
  class_name: "Grade 6",
  section: "A",
  roll_no: "12",
  designation: "Teacher",
  department: "Science",
  dob: "2013-05-12",
  blood_group: "B+",
  guardian_name: "R. Sharma",
  guardian_phone: "98765 43210",
  phone: "98765 00000",
  valid_until: "2026-03-31",
  academic_year: "2026-27",
  session: "SESSION 2026 – 27",
};

/** Build the id-keyed data map the CardSide renderer expects, for previews. */
export function buildPreviewData(
  side: TemplateSide,
  opts?: { logo?: string | null },
): CardSideData {
  const d: CardSideData = {};
  if (side.background) d.background = side.background;
  for (const el of side.elements) {
    if (el.type === "text") d[el.id] = el.text ?? "";
    else if (el.type === "field")
      d[el.id] = (el.field && SAMPLE_DATA[el.field]) || (el.field ? `{${el.field}}` : "");
    else if (el.type === "image") {
      const src =
        el.src === "logo"
          ? opts?.logo ?? ""
          : el.src === "photo_url" || el.src === "signature"
            ? ""
            : el.src ?? "";
      if (src) d[el.id] = src;
    }
    // qr / barcode render as a white box in preview; the real code is generated at print time.
  }
  return d;
}
