import "server-only";

// A4 print-shop sheet renderer (gang printing).
//
// Lays generated cards out on 210×297mm A4 pages at their template's physical
// width_mm/height_mm (CR80). Landscape cards gang 2 cols × 5 rows (10-up),
// portrait cards 3 cols × 3 rows (9-up), with uniform gutters computed so the
// grid is centred on the sheet. For every page-worth of cards TWO pages are
// emitted: the FRONTS grid, then the BACKS grid with each row's column order
// reversed — so a long-edge duplex pass lines every back up behind its front.
// Each card sits in an absolutely-positioned cell with a 0.2mm #BBBBBB outline
// as a cut guide. Mixed orientations in one batch are grouped and each group
// gets its own pages.

import type { IdTemplate, Member, School } from "@/lib/types";
import { SHEET_A4 } from "@/lib/constants";
import { cardSideToHtml } from "@/lib/render/card-html";
import { resolveSide } from "@/lib/card/resolve";
import { getBrowser } from "@/lib/render/browser";

/** Flattened class info for `class_name` / `section` bindings. */
type ClassInfo = { name: string; section: string | null } | null;

/** One card on the sheet: its template + the member (and class) it renders. */
export interface SheetEntry {
  template: IdTemplate;
  member: Member;
  classRow: ClassInfo;
}

/** Canonical CSS scale: 1 CSS px = 1/96 in → px-per-mm (same as render/pdf.ts). */
const CSS_PX_PER_MM = 96 / 25.4;

/** Cut-guide outline width (mm). */
const CUT_GUIDE_MM = 0.2;

/** An entry with both sides already resolved + rendered to HTML strings. */
type RenderedEntry = {
  entry: SheetEntry;
  front: string;
  back: string;
};

/** Wrap one rendered card side in its absolutely-positioned grid cell. */
function cellHtml(
  inner: string,
  col: number,
  row: number,
  cardWmm: number,
  cardHmm: number,
  cellWmm: number,
  cellHmm: number,
  gapXmm: number,
  gapYmm: number,
  scale: number,
): string {
  const leftMm = gapXmm + col * (cellWmm + gapXmm);
  const topMm = gapYmm + row * (cellHmm + gapYmm);
  const style = [
    "position:absolute",
    `left:${leftMm * scale}px`,
    `top:${topMm * scale}px`,
    `width:${cardWmm * scale}px`,
    `height:${cardHmm * scale}px`,
    `outline:${CUT_GUIDE_MM * scale}px solid #BBBBBB`,
    "overflow:hidden",
  ].join(";");
  return `<div style="${style}">${inner}</div>`;
}

/**
 * Lay one orientation group out as alternating FRONTS/BACKS A4 pages.
 * Returns the `<div class="pg">…</div>` page strings in print order.
 */
function groupPages(
  group: RenderedEntry[],
  orientation: IdTemplate["orientation"],
  scale: number,
): string[] {
  if (group.length === 0) return [];
  const cols = orientation === "landscape" ? 2 : 3;
  const rows = orientation === "landscape" ? 5 : 3;
  const perPage = cols * rows;

  // Uniform cell = the largest card in the group (all CR80 in practice), so
  // uniform gutters hold even if templates differ by a fraction of a mm.
  const cellW = Math.max(...group.map((r) => r.entry.template.width_mm));
  const cellH = Math.max(...group.map((r) => r.entry.template.height_mm));
  const gapX = (SHEET_A4.widthMm - cols * cellW) / (cols + 1);
  const gapY = (SHEET_A4.heightMm - rows * cellH) / (rows + 1);

  const pages: string[] = [];
  for (let start = 0; start < group.length; start += perPage) {
    const chunk = group.slice(start, start + perPage);
    const fronts: string[] = [];
    const backs: string[] = [];
    chunk.forEach((r, i) => {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const { width_mm, height_mm } = r.entry.template;
      fronts.push(
        cellHtml(r.front, col, row, width_mm, height_mm, cellW, cellH, gapX, gapY, scale),
      );
      // Mirror each row's column order so long-edge duplex aligns back to front.
      backs.push(
        cellHtml(r.back, cols - 1 - col, row, width_mm, height_mm, cellW, cellH, gapX, gapY, scale),
      );
    });
    pages.push(`<div class="pg">${fronts.join("")}</div>`);
    pages.push(`<div class="pg">${backs.join("")}</div>`);
  }
  return pages;
}

/**
 * Render a grid "card image set" — `cols`×`rows` card FRONTS per A4 page (e.g.
 * 5×5 = 25 per page), each scaled to fit its cell (CR80 cards larger than a cell
 * are shrunk, preserving aspect). Fronts only; a review/print-proof sheet, not a
 * duplex print run. Extra cards flow onto more pages.
 */
export async function renderCardGridPdf(
  entries: SheetEntry[],
  school: Partial<School>,
  cols = 5,
  rows = 5,
): Promise<Uint8Array> {
  const scale = CSS_PX_PER_MM;
  const MARGIN = 6;
  const GUTTER = 3;
  const perPage = cols * rows;

  const fronts = await Promise.all(
    entries.map(async (entry) => {
      const data = await resolveSide(entry.template.front, entry.member, entry.classRow, school);
      return {
        html: cardSideToHtml(
          entry.template.front,
          data,
          entry.template.width_mm,
          entry.template.height_mm,
          scale,
          true,
        ),
        w: entry.template.width_mm,
        h: entry.template.height_mm,
      };
    }),
  );

  const cellW = (SHEET_A4.widthMm - 2 * MARGIN - (cols - 1) * GUTTER) / cols;
  const cellH = (SHEET_A4.heightMm - 2 * MARGIN - (rows - 1) * GUTTER) / rows;

  const pages: string[] = [];
  for (let start = 0; start < fronts.length; start += perPage) {
    const chunk = fronts.slice(start, start + perPage);
    const cells = chunk.map((card, i) => {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const fit = Math.min(cellW / card.w, cellH / card.h);
      const drawW = card.w * fit;
      const drawH = card.h * fit;
      const leftMm = MARGIN + col * (cellW + GUTTER) + (cellW - drawW) / 2;
      const topMm = MARGIN + row * (cellH + GUTTER) + (cellH - drawH) / 2;
      const outer = [
        "position:absolute",
        `left:${leftMm * scale}px`,
        `top:${topMm * scale}px`,
        `width:${drawW * scale}px`,
        `height:${drawH * scale}px`,
        `outline:${CUT_GUIDE_MM * scale}px solid #BBBBBB`,
        "overflow:hidden",
      ].join(";");
      const inner = `width:${card.w * scale}px;height:${card.h * scale}px;transform:scale(${fit});transform-origin:top left`;
      return `<div style="${outer}"><div style="${inner}">${card.html}</div></div>`;
    });
    pages.push(`<div class="pg">${cells.join("")}</div>`);
  }

  const fonts =
    '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Poppins:wght@400;500;600;700;800&family=Montserrat:wght@400;500;600;700;800&display=swap">';
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">${fonts}<style>@page{size:A4;margin:0} html,body{margin:0;padding:0} *{-webkit-print-color-adjust:exact;print-color-adjust:exact} .pg{page-break-after:always;position:relative;width:${SHEET_A4.widthMm}mm;height:${SHEET_A4.heightMm}mm}</style></head><body>${pages.join("")}</body></html>`;

  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: "load" });
    await page.evaluate(async () => {
      await document.fonts.ready;
    });
    return await page.pdf({
      width: `${SHEET_A4.widthMm}mm`,
      height: `${SHEET_A4.heightMm}mm`,
      printBackground: true,
    });
  } finally {
    await page.close();
  }
}

/**
 * Render a batch of cards to a single duplex-ready A4 PDF as a `Uint8Array`.
 * Page order per chunk: fronts sheet, then the matching (mirrored) backs sheet.
 */
export async function renderPrintSheetPdf(
  entries: SheetEntry[],
  school: Partial<School>,
): Promise<Uint8Array> {
  const scale = CSS_PX_PER_MM;

  // Resolve bindings + render both sides of every card up front.
  const rendered: RenderedEntry[] = await Promise.all(
    entries.map(async (entry) => {
      const { template, member, classRow } = entry;
      const [frontData, backData] = await Promise.all([
        resolveSide(template.front, member, classRow, school),
        resolveSide(template.back, member, classRow, school),
      ]);
      return {
        entry,
        front: cardSideToHtml(
          template.front,
          frontData,
          template.width_mm,
          template.height_mm,
          scale,
          true,
        ),
        back: cardSideToHtml(
          template.back,
          backData,
          template.width_mm,
          template.height_mm,
          scale,
          true,
        ),
      };
    }),
  );

  // Group by orientation; each group lays out on its own pages.
  const landscape = rendered.filter((r) => r.entry.template.orientation === "landscape");
  const portrait = rendered.filter((r) => r.entry.template.orientation === "portrait");
  const pages = [
    ...groupPages(landscape, "landscape", scale),
    ...groupPages(portrait, "portrait", scale),
  ];

  // Web fonts used by templates (Poppins / Inter / Montserrat …) so the print
  // matches the designer even on hosts without them; document.fonts.ready waited below.
  const fonts =
    '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Poppins:wght@400;500;600;700;800&family=Montserrat:wght@400;500;600;700;800&display=swap">';

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">${fonts}<style>@page{size:A4;margin:0} html,body{margin:0;padding:0} *{-webkit-print-color-adjust:exact;print-color-adjust:exact} .pg{page-break-after:always;position:relative;width:${SHEET_A4.widthMm}mm;height:${SHEET_A4.heightMm}mm}</style></head><body>${pages.join("")}</body></html>`;

  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    // "load" settles images (photos/logos) + the fonts stylesheet; then wait for the
    // @font-face files themselves so text renders in the intended face, not a fallback.
    await page.setContent(html, { waitUntil: "load" });
    await page.evaluate(async () => {
      await document.fonts.ready;
    });
    const buf = await page.pdf({
      width: `${SHEET_A4.widthMm}mm`,
      height: `${SHEET_A4.heightMm}mm`,
      printBackground: true,
    });
    return buf;
  } finally {
    await page.close();
  }
}
