# Phase 2 + 3 Architecture — ID Card Template Designer & Print/QR Render Pipeline

Status: definitive. Stack: Next.js 16.2.9 (App Router, Turbopack), React 19.2.4, Tailwind v4, Supabase (`@supabase/ssr`), TypeScript strict (no `any`). Card: CR80 `85.6 × 54 mm @ 300 dpi → 1011 × 638 px` (`CARD_CR80` in `src/lib/constants.ts`).

This document is the single source of truth for: (1) the finalized template data model, (2) chosen libraries + the render approach, (3) a file-by-file implementation plan.

The whole architecture rests on **one law**:

> **There is exactly ONE card renderer and ONE unit-conversion module.** The editor preview, the list thumbnails, the on-screen "digital ID", the 300 dpi PNG, the CR80 PDF, and the A4 gang sheet are all the *same* `<CardRenderer>` called with a different `k` (px-per-mm) and a different `resolve` (binding → value). Never fork rendering logic. This is what guarantees WYSIWYG.

---

## 1. Finalized data model

**Decision: REUSE the existing `TemplateElement` / `TemplateSide` / `IdTemplate` in `src/lib/types.ts` unchanged in shape.** The DB already matches: `public.id_templates` stores `front`/`back` as `jsonb` (`supabase/migrations/0001_init.sql:89`), with `width_mm`, `height_mm`, `dpi`, `orientation`, `is_default`. **No migration is required for Phase 2.** `card_batches`, `generated_cards` (`pdf_url`), and the `cards` / `photos` / `logos` storage buckets already exist.

### 1.1 Invariants (already in the model — keep them)
- **All geometry is in millimetres.** `x, y, w, h` and the element box are mm. `rotation` is degrees. `fontSize` is **points (pt)**, never px.
- **`elements[]` array order IS z-order** (index 0 = bottom, last = top). No separate `z` field. Reordering = array splice.
- `field` binds to a `BINDABLE_FIELDS` key (`src/lib/constants.ts`); `src` binds `"photo_url" | "logo"` or a URL; `value` binds `"qr_token" | "identifier" | "verify_url"` or a literal.

### 1.2 Minimal ADDITIONS to `TemplateElement` (all optional → JSON back-compat, no migration)
Add these optional fields only. Because `front`/`back` are schemaless `jsonb`, older rows simply omit them.

```ts
export interface TemplateElement {
  // ... existing fields unchanged ...
  name?: string;          // layer label in the Layers panel (defaults derived from type)
  locked?: boolean;       // editor: ignore pointer/Moveable; still renders
  hidden?: boolean;       // editor-only: skip in CardRenderer when true (preview), always render in print
  opacity?: number;       // 0..1, for watermarks / faded backgrounds
  // text/field extras (CSS-mappable, keep print == preview):
  fontStyle?: "normal" | "italic";
  lineHeight?: number;    // unitless multiplier
  letterSpacing?: number; // mm
  valign?: "top" | "middle" | "bottom"; // vertical align inside the box (flexbox)
  // image extras:
  objectPosition?: string; // e.g. "center", "top" — CSS object-position
  // qr extras:
  ecLevel?: "L" | "M" | "Q" | "H"; // QR error-correction (default "M", "H" if logo overlay)
}
```

Everything else (`barcodeType`, `fill`, `borderColor`, `borderWidth`, `radius`, `fit`, `align`, `uppercase`, `color`, `fontFamily`, `fontWeight`) is already present and sufficient.

> Selection, multi-select, undo/redo, and active side are **runtime editor state only** — they live in the Zustand store, never in the persisted template.

### 1.3 Resolve contract (the binding layer)
`CardRenderer` is pure and binding-agnostic. It receives a `resolve` function. Member fields like `full_name`, `class_name`, `section` are **not** raw `Member` columns, so we resolve against a flattened view model:

```ts
// src/lib/card/cardData.ts
export interface CardData {
  member: Member;
  school: Pick<School, "name" | "short_name" | "logo_url" | "primary_color" | "secondary_color">;
  full_name: string;        // `${first_name} ${last_name ?? ""}`.trim()
  class_name: string | null;
  section: string | null;
  verify_url: string;       // `${APP_URL}/verify/${member.qr_token}`
  // asset overrides injected by the server resolver (data: URLs):
  assets: Record<string, string>; // elementId -> resolved text or data:URL
}
export type ResolveFn = (el: TemplateElement) => string;
```

- For **text/field** elements `resolve` returns a string.
- For **image/qr/barcode** elements `resolve` returns a `src` (http URL in the editor, `data:` URL in print). QR/barcode `data:` URLs are **SVG** (`data:image/svg+xml,…`) so they stay vector-crisp in the PDF.
- `rect` ignores `resolve`.

---

## 2. Chosen libraries + render approach

### 2.1 Library decisions (final)

| Concern | Choice | Rejected | Why |
|---|---|---|---|
| Editor transform engine | **`react-moveable`** | react-rnd (no rotation, owns DOM), react-konva (canvas = 2nd renderer, breaks WYSIWYG + fonts), dnd-kit (translate-only), hand-rolled pointer math | Overlays handles on a node *we* render → composes with the shared `CardRenderer`. Ships drag+resize+**rotate**+snapping (bounds + `elementGuidelines`). React 16–19. |
| Client-load Moveable | **`next/dynamic` `{ ssr:false }`** inside a `"use client"` file | importing at top level | Moveable touches `window`/`document`. **Next 16 rejects `ssr:false` in Server Components** (confirmed: *"`ssr: false` is not supported in Server Components"*, `node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md`). The overlay file MUST be `"use client"`. |
| Editor state | **Zustand** (`npm i zustand`) | useReducer | Transient (live drag) vs committed (mm) split, undo/redo history, fine-grained subscriptions to avoid re-rendering the whole canvas. |
| Print/PDF/PNG | **`puppeteer-core` + `@sparticuz/chromium`** (Node serverless route) | `@react-pdf/renderer` (different engine: Yoga+pdfkit, no CSS grid, no `background cover` parity → preview ≠ output), `window.print()`/`@page` (client-dependent, unbatchable) | Same Chromium engine renders the preview component AND the output → pixel-identical. `page.pdf` (vector text) + `page.screenshot` (raster). |
| Fallback renderer | **`playwright-core` + `@sparticuz/chromium`** | — | Drop-in same-engine API if puppeteer↔chromium drift breaks a deploy. |
| QR | **`qrcode@1.5.4`** (`QRCode.toString` SVG / `toBuffer` PNG) | — | Vector SVG for cards. |
| Barcode (Code128) | **`bwip-js@4.11.1`** — `bwip-js/node` (`toSVG` sync, `toBuffer` PNG) on server; `bwip-js/browser` (`toCanvas`) for any client-only live preview | bare `bwip-js` import | Subpath import avoids the browser build (which lacks `toBuffer`) being picked on the server. |
| Photo crop | **`react-easy-crop`** (installed) | — | Crop before placement into an image element. |

`npm i react-moveable zustand puppeteer-core @sparticuz/chromium` and `npm i -D playwright-core puppeteer` (full `puppeteer` is a **devDependency only**, for macOS local Chrome). `qrcode`, `bwip-js`, `react-easy-crop`, `xlsx` already installed.

### 2.2 The unit system (the second pillar)

`src/lib/designer/geometry.ts` is the ONLY place mm↔px lives.

```
MM_PER_IN     = 25.4
CSS_PX_PER_MM = 96 / 25.4   ≈ 3.7795   ← canonical CSS scale (1 CSS px = 1/96 in)
DEVICE_SCALE  = 300 / 96    = 3.125     ← deviceScaleFactor for 300 dpi raster
PRINT_PX_PER_MM = 300 / 25.4 = 11.811   = CSS_PX_PER_MM × DEVICE_SCALE  → 1011 × 638
```

Key insight reconciling the research: **the print document is laid out at `k = CSS_PX_PER_MM` (≈3.7795), and 300 dpi is achieved by Chromium's `deviceScaleFactor = 3.125`, not by inflating the viewport to 1011 px.** Proof: `85.6 mm × 3.7795 = 323.5 CSS px`; `323.5 × 3.125 = 1011 device px`. This keeps PDF text **vector** and physically `85.6 × 54 mm` while the PNG comes out exactly `1011 × 638`.

```ts
export const mmToPx = (mm: number, k: number) => mm * k;
export const pxToMm = (px: number, k: number) => px / k;
// 1 pt = 1/72 in = (96/72) CSS px; scale by k relative to CSS:
export const ptToPx = (pt: number, k: number) => pt * (k * MM_PER_IN / 72);
export const SAFE_MARGIN_MM = 3;  // editor guide overlay only
export const BLEED_MM = 2;        // gang sheet only
```

- **Editor display:** `k = displayK` = fit-to-container (e.g. `clamp` so the card is ~420–520 px wide). Everything (incl. `ptToPx`) scales by the same `k` → WYSIWYG at any zoom.
- **Print document:** `k = CSS_PX_PER_MM`.
- `bounds`, `elementGuidelines`, `verticalGuidelines`, `horizontalGuidelines` passed to Moveable are **pixels at `displayK`** — recompute from `k`.

### 2.3 The three outputs — all from one `<CardRenderer>` + `<CardDocument>`

`CardDocument` wraps `CardRenderer` (front and/or back) in a full HTML document with `<style>` for `@page` + fonts. It is rendered server-side to a string with `renderToStaticMarkup` and handed to Chromium via **`page.setContent(html, { waitUntil: "networkidle0" })`** (hermetic, no self-HTTP request, no auth juggling, all assets inlined as `data:` URLs).

1. **Single CR80 PDF** — `CardDocument` with `<style>@page{size:85.6mm 54mm;margin:0} html,body{margin:0}</style>`; card div sized `width:85.6mm;height:54mm` at `k=CSS_PX_PER_MM`. `page.pdf({ printBackground:true, preferCSSPageSize:true })`. **Edge-to-edge, NO crop marks** (PVC printers want full bleed). Text vector, photo/QR/barcode embedded.
2. **300 dpi PNG** — same document; `page.setViewport({ width:324, height:204, deviceScaleFactor:3.125 })`; `const el = await page.$("#card-front"); el.screenshot({ type:"png" })` → **exactly 1011 × 638**.
3. **A4 gang sheet PDF** — `CardDocument` gang variant: CSS grid of N cards (each `85.6×54mm`) with `BLEED_MM` gutters + **crop marks**; `page.pdf({ width:"210mm", height:"297mm", printBackground:true })`.
4. **On-screen preview / digital ID** — the **same** `CardRenderer` mounted in the designer and in `/print/*` debug routes (and reusable on the public `/verify` card later).

### 2.4 QR & barcode generation (server-only)

`src/lib/codes.ts` (`import "server-only"`, route/action `runtime = "nodejs"`):
- `qrSvgDataUrl(value, ecLevel="M")` → `QRCode.toString(value,{type:"svg",margin:2,errorCorrectionLevel})` → encode as `data:image/svg+xml`. Vector, crisp at any DPI.
- `code128SvgDataUrl(text)` → `bwipjs.toSVG({ bcid:"code128", text, height:8, includetext:true, textxalign:"center", paddingwidth:10, backgroundcolor:"ffffff" })` (synchronous — do **not** await) → `data:` URL.
- PNG buffer variants (`qrPngBuffer`, `code128PngBuffer`) kept for any raster compositing; QR raster `width` rounded to an integer multiple of `(moduleCount + 2·margin)` to avoid anti-alias blur (hurts scanning).
- **Always render codes on an explicit white backing** (the renderer draws a white rect behind qr/barcode element boxes); a code over the card's colored `TemplateSide.background` is unscannable. Code128 is ASCII-only → guard non-ASCII `identifier`.

These never enter a `"use client"` file (qrcode pulls a canvas path; `bwip-js/node` pulls zlib/Buffer → Turbopack would try to bundle Node builtins for the browser and fail).

### 2.5 Serverless rules (confirmed against bundled Next 16 docs)
- The render route sets `export const runtime = "nodejs"` and `export const maxDuration = 300`. **Edge cannot run Chromium.** (`route-segment-config/runtime.md`, `maxDuration.md`.)
- `next.config.ts` → `serverExternalPackages: ["puppeteer-core", "@sparticuz/chromium"]` so they use native `require` instead of being bundled (`serverExternalPackages.md`). Add `outputFileTracingIncludes` for the bundled font files.
- **Version lockstep (Context7-verified matrix):** `puppeteer-core 24.x → Chromium 126–130`, `25.x → 130–133`. Pin `@sparticuz/chromium` to a version whose Chromium major sits in that range (e.g. puppeteer-core 24.x ↔ `@sparticuz/chromium ~v130`). A mismatched minor silently fails to launch — re-check on every bump.
- **Fonts:** serverless Chromium ships ZERO fonts → Telugu/Hindi/Devanagari school names render as tofu boxes. Bundle `NotoSans` + `NotoSansDevanagari`/`Telugu` `.ttf`, register via `chromium.font(path)` **before** `puppeteer.launch`, and **always `await page.evaluateHandle("document.fonts.ready")` before `pdf()`/`screenshot()`**. Silent fidelity bug: looks fine locally (system fonts), breaks only on deploy.
- **Launch (Context7-verified):** `puppeteer.launch({ args: chromium.args, executablePath: await chromium.executablePath(process.env.CHROMIUM_PACK_URL), headless: "shell" })`; set `chromium.setGraphicsMode = false`. Locally gate on `NODE_ENV==="development"` → `{ channel:"chrome", headless:true }`. `executablePath()` supports default / local-dir / remote-pack-URL (use `@sparticuz/chromium-min` + a Supabase-hosted brotli pack if the 250 MB function limit bites).
- **Browser singleton:** reuse one `Browser`, `close()` the **page** per request, keep the browser warm. For big batches, prefer ganging (~10 cards/PDF) over one-PDF-per-card; stream/queue and write to the `cards` bucket rather than holding the HTTP connection past 300 s.

---

## 3. File-by-file implementation plan

Follows existing conventions: server actions in `actions.ts` with `"use server"` + a `ctx()` auth/school helper (`src/app/(app)/members/actions.ts`), Zod in `src/lib/validators.ts` + `formToObject`, redirect-with-`?error=`/`?ok=`, `createClient()` (RLS) for user data, `createAdminClient()` only for trusted bulk work, Tailwind slate palette, `@/*` path alias.

### 3.1 Shared model, geometry, codes, card rendering

| File | Kind | Responsibility |
|---|---|---|
| `src/lib/types.ts` | edit | Add the optional `TemplateElement` fields from §1.2. No interface renames. |
| `src/lib/designer/geometry.ts` | new | `CSS_PX_PER_MM`, `PRINT_PX_PER_MM`, `DEVICE_SCALE`, `mmToPx`, `pxToMm`, `ptToPx`, `SAFE_MARGIN_MM`, `BLEED_MM`, `fitScale(containerPx)`. The ONLY unit module. |
| `src/lib/designer/defaults.ts` | new | Element factories `newTextEl/newFieldEl/newImageEl/newQrEl/newBarcodeEl/newRectEl` (uuid + sane mm defaults), `blankTemplateSides()`. |
| `src/lib/designer/sampleMember.ts` | new | `SAMPLE_CARD_DATA: CardData` for live preview before a real member is chosen. |
| `src/lib/card/cardData.ts` | new | `CardData` type + `buildCardData(member, classRow, school)` (flattens `full_name`, `class_name`, `verify_url`). Pure. |
| `src/lib/codes.ts` | new | `import "server-only"`. QR + Code128 SVG/`data:`/PNG generators (§2.4). |
| `src/components/card/CardRenderer.tsx` | new | **PURE, no `"use client"`, no Node imports.** `({ side, k, resolve }) => JSX`. Absolutely-positioned `div`/`img` per element; applies `rotation`, `opacity`, `ptToPx` font, `valign` flex, white backing for qr/barcode, `objectFit`. Skips `hidden` in preview. Shared by editor + print + thumbnails. Includes `ElementContent`. |
| `src/components/card/CardDocument.tsx` | new | Wraps `CardRenderer` in full `<html>` + `@page`/font `<style>`; `single` and `gang` (grid + crop marks + bleed) variants. Rendered via `renderToStaticMarkup`. |

### 3.2 Print / render pipeline

| File | Kind | Responsibility |
|---|---|---|
| `src/lib/card/resolve.ts` | new | `import "server-only"`. `resolveSide(side, cardData, { mode })` → builds the `assets` map: text via `BINDABLE_FIELDS`, code `data:` URLs via `codes.ts`, photo inlined as `data:` URL (fetch public photo server-side → base64) for `mode:"print"` or passthrough URL for `mode:"preview"`. Returns a `ResolveFn`. |
| `src/lib/render/browser.ts` | new | `getBrowser()` singleton (§2.5): `@sparticuz/chromium` + `puppeteer-core`, `setGraphicsMode=false`, `chromium.font(...)` preload, local `channel:"chrome"` gate. |
| `src/lib/render/cardHtml.tsx` | new | `import "server-only"`. `buildCardHtml(template, cardData, { mode, side })` → `renderToStaticMarkup(<CardDocument…>)` string with all assets resolved/inlined. |
| `src/lib/render/pdf.ts` | new | `renderCardPdf(template, cardData)`, `renderGangPdf(template, cards[])`, `renderCardPng(template, cardData)` → `Buffer`. Uses `getBrowser` → `newPage` → `setContent` → `document.fonts.ready` → `pdf`/`screenshot` → `page.close()`. |
| `src/app/api/render/route.ts` | new | `POST`, `runtime="nodejs"`, `maxDuration=300`. Auth+school via session `createClient()` (RLS scopes the member/template fetch); dispatch `single`/`gang`/`png`; optionally upload to `cards` bucket + insert `generated_cards`; return file or signed URL. |
| `next.config.ts` | edit | `serverExternalPackages: ["puppeteer-core","@sparticuz/chromium"]` + `outputFileTracingIncludes` for `./fonts/**`. |
| `public/fonts/…` (or `fonts/`) | new | `NotoSans-Regular.ttf` + `NotoSansDevanagari-Regular.ttf` + `NotoSansTelugu-Regular.ttf`. |
| `src/app/(app)/print/card/[id]/page.tsx` | new | Server component rendering `CardDocument` (single) for browser debug + `window.print()` manual fallback. Session auth. |
| `src/app/(app)/print/gang/page.tsx` | new | Server component rendering the gang sheet for debug/manual print. |

### 3.3 Templates feature — list, CRUD, designer

| File | Kind | Responsibility |
|---|---|---|
| `src/app/(app)/templates/page.tsx` | new | Server list: fetch `id_templates` (RLS), grid of `CardRenderer` thumbnails (small `k`, `SAMPLE_CARD_DATA`), `is_default` badge, actions New/Edit/Duplicate/Delete/Set-default. Reads `?ok`/`?error`. |
| `src/app/(app)/templates/actions.ts` | new | `"use server"` + `ctx()`: `createBlankTemplate`, `updateTemplate(id, frontJson, backJson, meta)`, `renameTemplate`, `duplicateTemplate`, `deleteTemplate`, `setDefaultTemplate` (clears others' `is_default` in a txn), and `previewTemplateAssets(elements, sampleMemberId?)` → resolved code/photo `data:` URLs for the editor. Validates JSON with `templateSideSchema`. |
| `src/lib/validators.ts` | edit | Add `templateMetaSchema` (name, orientation) + `templateElementSchema`/`templateSideSchema` (Zod) to validate persisted JSON shape and clamp mm into the card bounds. |
| `src/app/(app)/templates/new/page.tsx` | new | Calls `createBlankTemplate` → redirect to `/templates/[id]/edit`. |
| `src/app/(app)/templates/[id]/edit/page.tsx` | new | Server component: load template + classes + `SAMPLE_CARD_DATA`; render `<TemplateDesigner template … />`. |
| `src/app/(app)/templates/[id]/edit/TemplateDesigner.tsx` | new | `"use client"` root. Hydrates the Zustand store from the template, lays out Toolbar + Palette + CardCanvas + Inspector + LayersPanel + front/back switch; debounced autosave via `updateTemplate`; fetches preview assets. |

### 3.4 Designer interaction components (all `"use client"`)

| File | Responsibility |
|---|---|
| `src/components/designer/store.ts` | Zustand store: `{ front, back, activeSide, selectedId, draftDirty, history }` + `addElement/updateElement(id,patch)/removeElement/reorder/select/setSide/setBackground/undo/redo`. **mm domain only.** `updateElement` is the single commit point for Moveable, Inspector, and keyboard nudge. |
| `src/components/designer/CardCanvas.tsx` | Renders `CardRenderer` at `displayK` with the resolved preview map; mounts `ElementOverlay` for the selected node; palette **drop** (15-line `pointerdown`), arrow-key **nudge** (1 mm; 0.1 mm with Shift), grid + `SAFE_MARGIN_MM` + bleed guide overlays (editor only — never in `CardRenderer`, so they never leak into print). `key={selectedId}` (or `moveableRef.updateRect()` after store re-renders) so handles re-align. |
| `src/components/designer/ElementOverlay.tsx` | `const Moveable = dynamic(() => import("react-moveable"), { ssr:false })`. One instance targeting `[data-el-id="…"]`, `draggable resizable rotatable snappable`, `origin={false}`, `bounds={{left:0,top:0,right:W,bottom:H,position:"css"}}`, `elementGuidelines={siblingSelectors}`, `verticalGuidelines=[0,W/2,W]`, `horizontalGuidelines=[0,H/2,H]`, `snapThreshold={6}`. **Live: mutate `target.style.*` in `onDrag/onResize/onRotate` (60 fps). Commit mm only in `onDragEnd/onResizeEnd/onRotateEnd`.** Resize MUST apply both `target.style.width/height` AND `drag.left/drag.top`, then store all four (w,h,x,y). Rotate commits `lastEvent.rotate` (clean degrees), not Moveable's matrix. (Event shapes Context7-verified.) |
| `src/components/designer/Inspector.tsx` | Numeric **mm/pt** inputs + per-type props (text: font family/size/weight/style/color/align/valign/uppercase/spacing; image: binding/fit/radius/objectPosition + `react-easy-crop` launcher; qr: value binding/ecLevel; barcode: type/value; rect: fill/border) → `store.updateElement`. The precision path a print shop needs; direct manipulation alone can't hit exact mm. |
| `src/components/designer/Palette.tsx` | Add buttons for each element type; field picker sourced from `BINDABLE_FIELDS`. |
| `src/components/designer/LayersPanel.tsx` | Element list in z-order (reorder, lock, hide, rename, delete, select). |
| `src/components/designer/Toolbar.tsx` | Save state, undo/redo, front/back toggle, zoom, grid/safe-area toggles, background (color/image) setter, "Test print" → `POST /api/render` with `SAMPLE_CARD_DATA`. |

### 3.5 Cards feature (Phase 3 surface that consumes the pipeline)

| File | Responsibility |
|---|---|
| `src/app/(app)/cards/page.tsx` | Pick template + members (or a saved `card_batch`); trigger single/gang render; list `generated_cards` with download links + status. |
| `src/app/(app)/cards/actions.ts` | `"use server"` + `ctx()`: `createBatch`, `generateForMembers(templateId, memberIds, format)` → calls `src/lib/render/pdf.ts`, uploads to `cards` bucket, inserts `generated_cards`, sets `card_status`, `revalidatePath("/cards")`. |

---

## 4. Top gotchas (must-not-violate)

1. **One renderer, one geometry module.** Editor and print both call `CardRenderer` with only `k` + `resolve` differing. Fonts are pt → always `ptToPx(pt,k)`.
2. **`ssr:false` only in a `"use client"` file** (`ElementOverlay`). `CardRenderer`/`CardDocument` stay pure/server-safe.
3. **Moveable: mutate DOM live, commit mm at `*End` only.** Committing every frame re-renders the tree and fights Moveable (jitter). Resize must persist all four of w,h,x,y (apply `drag.left/top`).
4. **Print fidelity:** `await document.fonts.ready` before `pdf()`/`screenshot()`; bundle + `chromium.font()` Indian-script fonts; `printBackground:true`; single card edge-to-edge (no crop marks), crop marks/bleed only on the gang sheet.
5. **DPI via `deviceScaleFactor=3.125` over a `CSS_PX_PER_MM` layout**, not a 1011 px viewport. Verify PNG is exactly `1011 × 638`.
6. **Server-only codes.** Keep `qrcode`/`bwip-js/node` out of every `"use client"` file; route is `runtime="nodejs"`. Use `bwip-js/node` (sync `toSVG`, `toBuffer`) — never the bare `bwip-js` import on the server.
7. **Version lockstep** `puppeteer-core` ↔ `@sparticuz/chromium` (24.x→Chromium 126–130, 25.x→130–133). Reuse one browser, close pages; gang for batches; keep `puppeteer` (full) a devDependency for macOS.
8. **Codes need a white backing** and ASCII-safe `identifier`; bind QR to `member.qr_token`/`verify_url`.
9. **No DB migration for Phase 2** — `front`/`back` are `jsonb`; new element fields are optional. `card_batches`/`generated_cards`/`cards` bucket already exist.
