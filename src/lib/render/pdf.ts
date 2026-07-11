import "server-only";

// Card → CR80 PDF via headless Chromium (PHASE-2-3-ARCHITECTURE §2.3).
//
// The SAME pure `<CardSide>` renderer that draws the editor preview is rendered
// to a static HTML string here (front then back), wrapped in one `@page`-sized
// document, and printed by Chromium. Same engine both sides of the pipeline →
// pixel-identical WYSIWYG. Layout scale is 96/25.4 px-per-mm (canonical CSS),
// so PDF text stays vector and the card stays physically width_mm × height_mm.

import type { IdTemplate, Member, School } from "@/lib/types";
import { cardSideToHtml } from "@/lib/render/card-html";
import { resolveSide } from "@/lib/card/resolve";
import { getBrowser } from "@/lib/render/browser";

/** Flattened class info for `class_name` / `section` bindings. */
type ClassInfo = { name: string; section: string | null } | null;

/** Canonical CSS scale: 1 CSS px = 1/96 in → px-per-mm. */
const CSS_PX_PER_MM = 96 / 25.4;

/**
 * Render a member's card (front + back) to a single CR80 PDF as a `Uint8Array`.
 * Edge-to-edge, no crop marks — PVC card printers want full bleed.
 */
export async function renderCardPdf(
  template: IdTemplate,
  member: Member,
  classRow: ClassInfo,
  school: Partial<School>,
): Promise<Uint8Array> {
  const scale = CSS_PX_PER_MM;
  const { width_mm, height_mm } = template;

  const [frontData, backData] = await Promise.all([
    resolveSide(template.front, member, classRow, school),
    resolveSide(template.back, member, classRow, school),
  ]);

  const front = cardSideToHtml(template.front, frontData, width_mm, height_mm, scale, true);
  const back = cardSideToHtml(template.back, backData, width_mm, height_mm, scale, true);

  // Web fonts used by templates (Poppins / Inter / Montserrat …) so the print
  // matches the designer even on hosts without them; document.fonts.ready waited below.
  const fonts =
    '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Poppins:wght@400;500;600;700;800&family=Montserrat:wght@400;500;600;700;800&display=swap">';

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">${fonts}<style>@page{size:${width_mm}mm ${height_mm}mm;margin:0} html,body{margin:0;padding:0} *{-webkit-print-color-adjust:exact;print-color-adjust:exact} .pg{page-break-after:always;overflow:hidden}</style></head><body><div class="pg">${front}</div><div class="pg">${back}</div></body></html>`;

  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    // "load" settles images (photos/logos) + the fonts stylesheet; then wait for the
    // @font-face files themselves so text renders in the intended face, not a fallback.
    await page.setContent(html, { waitUntil: "load" });
    await page.evaluate(async () => {
      await document.fonts.ready;
    });
    // Auto-fit text so long values never overflow their box or overlap the rows
    // below. The member name is shrunk on a single line; other text shrinks to
    // fit its box (may wrap). Runs in the real browser, so measurements are exact.
    await page.evaluate(() => {
      const MIN = 6; // px floor
      const fit = (el: Element, singleLine: boolean) => {
        const box = el as HTMLElement;
        const inner = box.querySelector<HTMLElement>("[data-fit-inner]");
        if (!inner) return;
        if (singleLine) inner.style.whiteSpace = "nowrap";
        let size = parseFloat(getComputedStyle(inner).fontSize) || 12;
        const overflowing = () =>
          box.scrollWidth > box.clientWidth + 0.5 ||
          box.scrollHeight > box.clientHeight + 0.5;
        let guard = 80;
        while (guard-- > 0 && overflowing() && size > MIN) {
          size -= 0.5;
          inner.style.fontSize = `${size}px`;
        }
      };
      document.querySelectorAll('[data-fit="name"]').forEach((el) => fit(el, true));
      document.querySelectorAll('[data-fit="text"]').forEach((el) => fit(el, false));
    });
    const buf = await page.pdf({
      width: `${width_mm}mm`,
      height: `${height_mm}mm`,
      printBackground: true,
    });
    return buf;
  } finally {
    await page.close();
  }
}
