/**
 * src/lib/codes.ts — QR & Code128 generators for the ID-card pipeline.
 *
 * ISOMORPHIC by design: this module imports the *universal* builds of `qrcode`
 * and `bwip-js`, so it is safe to import from BOTH client and server components.
 *  - `qrcode`  resolves to `lib/browser.js` (canvas) in the browser and the Node
 *    build on the server via its package `browser` field — `toDataURL`/`toString`
 *    exist in both and return identical data URLs.
 *  - `bwip-js/browser` is the standalone build: a pure-JS UMD module with the
 *    OCR-B font embedded and NO Node builtins (no Buffer/zlib/DOM). Its `toSVG`
 *    is a synchronous string builder that runs unchanged in the browser AND in
 *    Node, and Turbopack bundles it for both targets without polyfills — unlike
 *    `bwip-js/node` (pulls zlib/Buffer → breaks the client bundle) or the bare
 *    `bwip-js` import (its `.` export exposes only environment conditions, so it
 *    fails to type-resolve under `moduleResolution: "bundler"`).
 *
 * Because of that, do NOT add `import "server-only"` here, do NOT switch to
 * `bwip-js/node`, and do NOT call the Node-only `toBuffer` (PNG buffer) from this
 * file — keep raster compositing in a separate server-only module if ever needed.
 *
 * Conventions (per docs/PHASE-2-3-ARCHITECTURE.md §2.4):
 *  - QR/Code128 are always drawn on an explicit WHITE backing so they stay
 *    scannable over a coloured card background. Defaults below bake that in.
 *  - Code128 encodes ASCII only — non-ASCII input throws instead of silently
 *    producing an unscannable symbol.
 */

import QRCode, { type QRCodeErrorCorrectionLevel } from "qrcode";
import bwipjs from "bwip-js/browser";

/** Bwip-js render options, derived from the installed build's `toSVG` signature. */
type BwipRenderOptions = Parameters<typeof bwipjs.toSVG>[0];

const MM_PER_INCH = 25.4;

/** QR error-correction level. "H" recovers ~30% (use when a logo overlays the QR). */
export type QrEcLevel = "L" | "M" | "Q" | "H";

export interface QrOptions {
  /**
   * Output size in **pixels** (square). Honoured by the PNG/raster path and used
   * as the SVG `width`/`height` attribute. The `qrcode` lib floors the per-module
   * scale to an integer, so modules stay crisp (no anti-alias blur) at any DPI.
   * @default 512
   */
  size?: number;
  /** Quiet-zone width in QR **modules**. Spec minimum is 4; 2 is the common card compromise. @default 2 */
  margin?: number;
  /** Error-correction level. @default "M" */
  ecLevel?: QrEcLevel;
  /** Dark-module colour, `#rrggbb` or `#rrggbbaa`. @default "#000000ff" */
  dark?: string;
  /** Light/background colour, `#rrggbb` or `#rrggbbaa`. White → scannable on coloured cards. @default "#ffffffff" */
  light?: string;
}

const QR_SIZE_DEFAULT = 512;
const QR_MARGIN_DEFAULT = 2;
const QR_EC_DEFAULT: QrEcLevel = "M";
const QR_DARK_DEFAULT = "#000000ff";
const QR_LIGHT_DEFAULT = "#ffffffff";

function normalizeQr(value: string, options: QrOptions): {
  text: string;
  width: number;
  margin: number;
  errorCorrectionLevel: QRCodeErrorCorrectionLevel;
  color: { dark: string; light: string };
} {
  const text = value.trim();
  if (!text) throw new Error("codes: QR `value` must be a non-empty string.");
  return {
    text,
    width: Math.max(1, Math.round(options.size ?? QR_SIZE_DEFAULT)),
    margin: Math.max(0, Math.round(options.margin ?? QR_MARGIN_DEFAULT)),
    errorCorrectionLevel: options.ecLevel ?? QR_EC_DEFAULT,
    color: { dark: options.dark ?? QR_DARK_DEFAULT, light: options.light ?? QR_LIGHT_DEFAULT },
  };
}

/**
 * (a) Generate a QR code as a PNG **data URL** (`data:image/png;base64,…`).
 * Suitable for on-screen preview and 300 dpi print: pass a `size` matched to the
 * target box (see {@link pxForMm}); modules are integer-scaled so they stay sharp.
 */
export async function qrPngDataUrl(value: string, options: QrOptions = {}): Promise<string> {
  const { text, width, margin, errorCorrectionLevel, color } = normalizeQr(value, options);
  return QRCode.toDataURL(text, { type: "image/png", width, margin, errorCorrectionLevel, color });
}

/**
 * Vector QR as an SVG **data URL** (`data:image/svg+xml,…`). Infinitely crisp —
 * preferred inside the print PDF where text/vectors stay resolution-independent.
 */
export async function qrSvgDataUrl(value: string, options: QrOptions = {}): Promise<string> {
  const { text, width, margin, errorCorrectionLevel, color } = normalizeQr(value, options);
  const svg = await QRCode.toString(text, { type: "svg", width, margin, errorCorrectionLevel, color });
  return svgToDataUrl(svg);
}

export interface Code128Options {
  /** Bar height in **millimetres** (bwip-js native unit). @default 8 */
  heightMm?: number;
  /** Module scale multiplier; higher → more device px per bar for raster consumers. @default 3 */
  scale?: number;
  /** Render the human-readable text under the bars. @default true */
  includeText?: boolean;
  /** Background colour as `rrggbb` (no `#`). White → scannable on coloured cards. @default "ffffff" */
  background?: string;
  /** Bar/foreground colour as `rrggbb` (no `#`). @default "000000" */
  barColor?: string;
  /** Horizontal quiet-zone padding in **millimetres** on each side. @default 2 */
  paddingMm?: number;
}

/** Code128 is ASCII-only (code points 0–127). */
// eslint-disable-next-line no-control-regex
const ASCII_ONLY = /^[\x00-\x7F]+$/;

function buildCode128Options(text: string, options: Code128Options): BwipRenderOptions {
  const value = text.trim();
  if (!value) throw new Error("codes: Code128 `text` must be a non-empty string.");
  if (!ASCII_ONLY.test(value)) {
    throw new Error(`codes: Code128 encodes ASCII only; received non-ASCII text "${value}".`);
  }
  return {
    bcid: "code128",
    text: value,
    height: options.heightMm ?? 8,
    scale: options.scale ?? 3,
    includetext: options.includeText ?? true,
    textxalign: "center",
    backgroundcolor: options.background ?? "ffffff",
    barcolor: options.barColor ?? "000000",
    paddingwidth: options.paddingMm ?? 2,
  };
}

/**
 * (b) Generate a Code128 barcode as a raw **SVG string** via `bwip-js`.
 * (`bwipjs.toSVG` is synchronous; wrapped in `async` for a uniform Promise API
 * and to keep call sites future-proof.)
 */
export async function code128Svg(text: string, options: Code128Options = {}): Promise<string> {
  return bwipjs.toSVG(buildCode128Options(text, options));
}

/** Code128 SVG as a data URL, ready to drop into an `<img src>` or CSS `background`. */
export async function code128SvgDataUrl(text: string, options: Code128Options = {}): Promise<string> {
  return svgToDataUrl(await code128Svg(text, options));
}

/**
 * Pixels for a physical length — size QR/barcode rasters for print.
 * e.g. `pxForMm(20)` → 236 px for a 20 mm QR at 300 dpi (matches `CARD_CR80` math).
 */
export function pxForMm(mm: number, dpi = 300): number {
  return Math.max(1, Math.round((mm / MM_PER_INCH) * dpi));
}

/**
 * UTF-8-safe SVG → data URL. Uses `encodeURIComponent` (not base64/Buffer) so it
 * works identically in the browser and Node without a polyfill.
 */
function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
