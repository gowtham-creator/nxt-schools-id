// The ONE card renderer (PHASE-2-3-ARCHITECTURE §2.3, §3.1).
//
// PURE + presentational. No "use client", no Node imports, no data fetching.
// The exact same component renders:
//   - the live designer preview / list thumbnails (scale = displayK, http asset URLs)
//   - the server-side print HTML (scale = CSS_PX_PER_MM, inlined data: URLs)
// renderToStaticMarkup-safe, so it powers <CardDocument> for puppeteer too.
//
// All template geometry is millimetres; `scale` is px-per-mm (the "k" in the
// architecture). Font sizes are points and are converted with the same `k`, so
// the result is WYSIWYG at any zoom or DPI.

import type { CSSProperties } from "react";
import type { TemplateElement, TemplateSide } from "@/lib/types";

const MM_PER_IN = 25.4;

/** millimetres -> CSS px at the given px-per-mm scale. */
const mmToPx = (mm: number, k: number): number => mm * k;
/** points -> CSS px, scaled by the same k so 1pt stays physically correct. */
const ptToPx = (pt: number, k: number): number => (pt * k * MM_PER_IN) / 72;

/** Matches an asset reference (URL / data: / blob: / css url()) vs a literal CSS colour. */
const ASSET_RE = /^(https?:|data:|blob:|url\(|\/)/i;

/**
 * The resolved value map handed to the renderer.
 *
 * Keyed primarily by `element.id` (matching `CardData.assets` in the architecture):
 *   - text / field  -> the resolved display string
 *   - image         -> a src URL (http in preview, data: in print)
 *   - qr / barcode  -> a data:image/svg+xml URL produced by `src/lib/codes.ts`
 * Falls back to the element's binding key (`field` / `src` / `value`) so callers
 * may instead key by binding name. The reserved key `"background"` overrides the
 * side background (lets the print resolver inline it without cloning the side).
 */
export type CardSideData = Record<string, string>;

export interface CardSideProps {
  side: TemplateSide;
  data: CardSideData;
  /** Card width in millimetres (e.g. CARD_CR80.widthMm). */
  widthMm: number;
  /** Card height in millimetres (e.g. CARD_CR80.heightMm). */
  heightMm: number;
  /** px-per-mm. Designer: fit-to-container displayK. Print: CSS_PX_PER_MM. */
  scale: number;
  /** DOM id for the card root, e.g. "card-front" so puppeteer can screenshot `#card-front`. */
  id?: string;
  className?: string;
  /** Render elements flagged `hidden` (true for print; false/omitted hides them in the editor preview). */
  renderHidden?: boolean;
}

function backgroundStyle(bg: string | null | undefined): CSSProperties {
  if (!bg) return {};
  if (ASSET_RE.test(bg)) {
    return {
      backgroundImage: bg.startsWith("url(") ? bg : `url("${bg}")`,
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
    };
  }
  return { backgroundColor: bg };
}

function CardElement({
  el,
  data,
  scale,
  z,
}: {
  el: TemplateElement;
  data: CardSideData;
  scale: number;
  z: number;
}) {
  const base: CSSProperties = {
    position: "absolute",
    left: mmToPx(el.x, scale),
    top: mmToPx(el.y, scale),
    width: mmToPx(el.w, scale),
    height: mmToPx(el.h, scale),
    transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
    transformOrigin: "center center",
    opacity: el.opacity,
    zIndex: z,
    boxSizing: "border-box",
  };

  switch (el.type) {
    case "rect": {
      return (
        <div
          data-el-id={el.id}
          style={{
            ...base,
            backgroundColor: el.fill,
            border:
              el.borderWidth && el.borderWidth > 0
                ? `${mmToPx(el.borderWidth, scale)}px solid ${el.borderColor ?? "#000000"}`
                : undefined,
            borderRadius: el.radius ? mmToPx(el.radius, scale) : undefined,
          }}
        />
      );
    }

    case "text":
    case "field": {
      const value =
        el.type === "field"
          ? data[el.id] ?? (el.field ? data[el.field] : undefined) ?? ""
          : data[el.id] ?? el.text ?? "";
      const valign = el.valign ?? "top";
      return (
        <div
          data-el-id={el.id}
          style={{
            ...base,
            display: "flex",
            flexDirection: "column",
            justifyContent:
              valign === "middle" ? "center" : valign === "bottom" ? "flex-end" : "flex-start",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: "100%",
              textAlign: el.align ?? "left",
              color: el.color ?? "#000000",
              fontFamily: el.fontFamily,
              fontSize: ptToPx(el.fontSize ?? 12, scale),
              fontWeight: el.fontWeight,
              fontStyle: el.fontStyle,
              lineHeight: el.lineHeight ?? 1.2,
              letterSpacing:
                el.letterSpacing != null ? mmToPx(el.letterSpacing, scale) : undefined,
              textTransform: el.uppercase ? "uppercase" : undefined,
              whiteSpace: "pre-wrap",
              overflowWrap: "break-word",
              wordBreak: "break-word",
            }}
          >
            {value}
          </div>
        </div>
      );
    }

    case "image": {
      const src =
        data[el.id] ??
        (el.src ? data[el.src] ?? (ASSET_RE.test(el.src) ? el.src : undefined) : undefined);
      return (
        <div
          data-el-id={el.id}
          style={{
            ...base,
            overflow: "hidden",
            borderRadius: el.radius ? mmToPx(el.radius, scale) : undefined,
            backgroundColor: src ? undefined : "#e2e8f0",
          }}
        >
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element -- pure renderer must work under renderToStaticMarkup (print) where next/image cannot run
            <img
              src={src}
              alt=""
              style={{
                width: "100%",
                height: "100%",
                objectFit: el.fit ?? "cover",
                objectPosition: el.objectPosition ?? "center",
                display: "block",
              }}
            />
          ) : null}
        </div>
      );
    }

    case "qr":
    case "barcode": {
      // Codes always sit on an explicit white backing — a code over a coloured
      // card background is unscannable (architecture §2.4).
      const src = data[el.id] ?? (el.value ? data[el.value] : undefined);
      return (
        <div
          data-el-id={el.id}
          style={{
            ...base,
            backgroundColor: "#ffffff",
            padding: mmToPx(0.5, scale),
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element -- vector SVG data: URL, must render in static print HTML
            <img
              src={src}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
            />
          ) : null}
        </div>
      );
    }

    default:
      return null;
  }
}

/**
 * Renders ONE side of an ID card by absolutely positioning every element.
 * Z-order is array order (index 0 = bottom). The root clips to the card bounds
 * so nothing bleeds past the physical edge.
 */
export function CardSide({
  side,
  data,
  widthMm,
  heightMm,
  scale,
  id,
  className,
  renderHidden = false,
}: CardSideProps) {
  return (
    <div
      id={id}
      className={className}
      data-card-side=""
      style={{
        position: "relative",
        width: mmToPx(widthMm, scale),
        height: mmToPx(heightMm, scale),
        overflow: "hidden",
        boxSizing: "border-box",
        ...backgroundStyle(data.background ?? side.background),
      }}
    >
      {side.elements.map((el, i) =>
        el.hidden && !renderHidden ? null : (
          <CardElement key={el.id} el={el} data={data} scale={scale} z={i} />
        ),
      )}
    </div>
  );
}

export default CardSide;
