import "server-only";

// Server-side HTML string builder for the print pipeline.
//
// This is the STRING twin of the React <CardSide> in @/lib/card-render. It emits
// byte-for-byte the same absolutely-positioned markup + inline styles, but as a
// plain string — so nothing here (or in its importers) pulls in `react-dom/server`,
// which Next 16 forbids anywhere in a Server Component / Server Action import graph.
// Keep this in lockstep with CardSide's CardElement so print === on-screen preview.

import type { TemplateElement, TemplateSide } from "@/lib/types";
import type { CardSideData } from "@/lib/card-render";

const MM_PER_IN = 25.4;
/** millimetres -> CSS px at the given px-per-mm scale. */
const mmToPx = (mm: number, k: number): number => mm * k;
/** points -> CSS px, scaled by the same k so 1pt stays physically correct. */
const ptToPx = (pt: number, k: number): number => (pt * k * MM_PER_IN) / 72;
/** Matches an asset reference (URL / data: / blob: / css url()) vs a literal CSS colour. */
const ASSET_RE = /^(https?:|data:|blob:|url\(|\/)/i;

/** HTML-escape text nodes and attribute values (src, etc.). */
const esc = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/**
 * Escape a CSS declaration list for a double-quoted style="" attribute.
 * Critical for `background-image:url("data:image/svg+xml,…")` — without this
 * the url's own quotes terminate the attribute and the background is dropped.
 * Entities are decoded by the HTML parser before CSS parsing, so the CSS
 * engine still sees the real quotes.
 */
const attr = (s: string): string => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

/** Shared base geometry declarations (mirror of CardElement `base`). */
function baseDecls(el: TemplateElement, scale: number, z: number): string[] {
  const d: string[] = [
    "position:absolute",
    `left:${mmToPx(el.x, scale)}px`,
    `top:${mmToPx(el.y, scale)}px`,
    `width:${mmToPx(el.w, scale)}px`,
    `height:${mmToPx(el.h, scale)}px`,
    "transform-origin:center center",
    `z-index:${z}`,
    "box-sizing:border-box",
  ];
  if (el.rotation) d.push(`transform:rotate(${el.rotation}deg)`);
  if (el.opacity !== undefined && el.opacity !== null) d.push(`opacity:${el.opacity}`);
  return d;
}

function elementHtml(
  el: TemplateElement,
  data: CardSideData,
  scale: number,
  z: number,
): string {
  const idAttr = `data-el-id="${esc(el.id)}"`;

  switch (el.type) {
    case "rect": {
      const d = baseDecls(el, scale, z);
      if (el.fill) d.push(`background-color:${el.fill}`);
      if (el.borderWidth && el.borderWidth > 0)
        d.push(
          `border:${mmToPx(el.borderWidth, scale)}px solid ${el.borderColor ?? "#000000"}`,
        );
      if (el.radius) d.push(`border-radius:${mmToPx(el.radius, scale)}px`);
      return `<div ${idAttr} style="${attr(d.join(";"))}"></div>`;
    }

    case "text":
    case "field": {
      const value =
        el.type === "field"
          ? data[el.id] ?? (el.field ? data[el.field] : undefined) ?? ""
          : data[el.id] ?? el.text ?? "";
      const valign = el.valign ?? "top";
      const justify =
        valign === "middle" ? "center" : valign === "bottom" ? "flex-end" : "flex-start";
      const outer = [
        ...baseDecls(el, scale, z),
        "display:flex",
        "flex-direction:column",
        `justify-content:${justify}`,
        "overflow:hidden",
      ];
      const inner: string[] = [
        "width:100%",
        `text-align:${el.align ?? "left"}`,
        `color:${el.color ?? "#000000"}`,
        `font-size:${ptToPx(el.fontSize ?? 12, scale)}px`,
        `line-height:${el.lineHeight ?? 1.2}`,
        "white-space:pre-wrap",
        "overflow-wrap:break-word",
        "word-break:break-word",
      ];
      if (el.fontFamily) inner.push(`font-family:${el.fontFamily}`);
      if (el.fontWeight !== undefined && el.fontWeight !== null)
        inner.push(`font-weight:${el.fontWeight}`);
      if (el.fontStyle) inner.push(`font-style:${el.fontStyle}`);
      if (el.letterSpacing != null)
        inner.push(`letter-spacing:${mmToPx(el.letterSpacing, scale)}px`);
      if (el.uppercase) inner.push("text-transform:uppercase");
      // data-fit lets the print pipeline shrink text to fit its box. The member
      // name is fit on a single line so long names never overflow into the rows
      // below; all other text is fit within the box (may wrap).
      const fitKind = el.type === "field" && el.field === "full_name" ? "name" : "text";
      return `<div ${idAttr} data-fit="${fitKind}" style="${attr(outer.join(";"))}"><div data-fit-inner style="${attr(
        inner.join(";"),
      )}">${esc(value)}</div></div>`;
    }

    case "image": {
      const src =
        data[el.id] ??
        (el.src ? data[el.src] ?? (ASSET_RE.test(el.src) ? el.src : undefined) : undefined);
      const d = [...baseDecls(el, scale, z), "overflow:hidden"];
      if (el.radius) d.push(`border-radius:${mmToPx(el.radius, scale)}px`);
      // A missing photo keeps a subtle placeholder; a missing school logo renders
      // transparent (no ugly grey box on schools that haven't uploaded a logo yet).
      if (!src && el.src !== "logo") d.push("background-color:#e2e8f0");
      const img = src
        ? `<img src="${esc(src)}" alt="" style="width:100%;height:100%;object-fit:${
            el.fit ?? "cover"
          };object-position:${el.objectPosition ?? "center"};display:block"/>`
        : "";
      return `<div ${idAttr} style="${attr(d.join(";"))}">${img}</div>`;
    }

    case "qr":
    case "barcode": {
      const src = data[el.id] ?? (el.value ? data[el.value] : undefined);
      const d = [
        ...baseDecls(el, scale, z),
        "background-color:#ffffff",
        `padding:${mmToPx(0.5, scale)}px`,
        "overflow:hidden",
        "display:flex",
        "align-items:center",
        "justify-content:center",
      ];
      const img = src
        ? `<img src="${esc(
            src,
          )}" alt="" style="width:100%;height:100%;object-fit:contain;display:block"/>`
        : "";
      return `<div ${idAttr} style="${attr(d.join(";"))}">${img}</div>`;
    }

    default:
      return "";
  }
}

/** Background declarations (mirror of card-render `backgroundStyle`). */
function bgStyle(bg: string | null | undefined): string {
  if (!bg) return "";
  if (ASSET_RE.test(bg)) {
    const url = bg.startsWith("url(") ? bg : `url("${bg}")`;
    return `background-image:${url};background-size:cover;background-position:center;background-repeat:no-repeat`;
  }
  return `background-color:${bg}`;
}

/**
 * Render ONE side of a card to an HTML string. Identical output shape to
 * <CardSide> so the printed card matches the editor preview exactly.
 * `renderHidden` defaults to true (print shows layers hidden only in the editor).
 */
export function cardSideToHtml(
  side: TemplateSide,
  data: CardSideData,
  widthMm: number,
  heightMm: number,
  scale: number,
  renderHidden = true,
): string {
  const root = [
    "position:relative",
    `width:${mmToPx(widthMm, scale)}px`,
    `height:${mmToPx(heightMm, scale)}px`,
    "overflow:hidden",
    "box-sizing:border-box",
  ];
  const bg = bgStyle(data.background ?? side.background);
  if (bg) root.push(bg);
  const els = side.elements
    .map((el, i) => (el.hidden && !renderHidden ? "" : elementHtml(el, data, scale, i)))
    .join("");
  return `<div data-card-side="" style="${attr(root.join(";"))}">${els}</div>`;
}
