// Seeds the two "standard practice" ID-card templates (portrait + landscape).
// Design synthesized from 9 real school-card references (see chat / DESIGN.md):
// header = logo + school name + address + phone, IDENTITY CARD ribbon, framed
// photo, bold name, ruled Label:Value rows, session, principal sign, wave
// footer; back = terms, if-found, blood/valid, QR verify + Code128 barcode.
//
// Usage: node scripts/seed-standard-templates.mjs
// Reads NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY from env or .env.local.

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
function env(key) {
  if (process.env[key]) return process.env[key];
  const txt = readFileSync(resolve(root, ".env.local"), "utf8");
  const m = txt.match(new RegExp(`^${key}=(.*)$`, "m"));
  if (!m) throw new Error(`Missing env ${key}`);
  return m[1].trim();
}
const URL_ = env("NEXT_PUBLIC_SUPABASE_URL");
const KEY = env("SUPABASE_SERVICE_ROLE_KEY");
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

async function q(path, opts = {}) {
  const r = await fetch(`${URL_}/rest/v1/${path}`, { ...opts, headers: { ...H, ...(opts.headers || {}) } });
  const t = await r.text();
  if (!r.ok) throw new Error(`${r.status} ${path}: ${t}`);
  return t ? JSON.parse(t) : null;
}

// ─── palette (green→blue "modern standard", gold accent) ─────────────────
const NAVY = "#1E3A8A";
const TEAL = "#0F766E";
const GREEN = "#059669";
const GOLD = "#F59E0B";
const GOLD_DARK = "#B45309";
const INK = "#0F172A";
const SLATE = "#334155";
const MUTED = "#475569";
const FAINT = "#64748B";
const HAIR = "#E2E8F0";
const RED = "#DC2626";
const HEAD_FONT = "Poppins, Inter, sans-serif";
const BODY_FONT = "Inter, sans-serif";

// Match the proven Aurora background format exactly: plain svg+xml prefix,
// single-quoted attributes, and 10x-scaled integer-ish viewBox units.
const svgUrl = (svg) =>
  `data:image/svg+xml,${encodeURIComponent(svg.replace(/"/g, "'").replace(/\s+/g, " ").trim())}`;

const GRAD = `<linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="${NAVY}"/><stop offset="0.55" stop-color="${TEAL}"/><stop offset="1" stop-color="${GREEN}"/>
</linearGradient>`;

// Portrait 540 × 856 (mm × 10) ─ front background: header band + gold rule + waves.
const P_FRONT_BG = svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 540 856"><defs>${GRAD}</defs>
<rect width="540" height="856" fill="#FFFFFF"/>
<rect width="540" height="205" fill="url(#g)"/>
<polygon points="0,0 220,0 80,205 0,205" fill="#FFFFFF" opacity="0.06"/>
<polygon points="300,0 540,0 540,140" fill="#FFFFFF" opacity="0.05"/>
<rect y="205" width="540" height="9" fill="${GOLD}"/>
<circle cx="270" cy="470" r="170" fill="${TEAL}" opacity="0.035"/>
<path d="M0,785 C160,750 360,820 540,770 L540,856 L0,856 Z" fill="${TEAL}" opacity="0.2"/>
<path d="M0,808 C150,772 380,846 540,796 L540,856 L0,856 Z" fill="url(#g)"/>
</svg>`);

// Portrait back background: slim band + gold rule + waves.
const P_BACK_BG = svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 540 856"><defs>${GRAD}</defs>
<rect width="540" height="856" fill="#FFFFFF"/>
<rect width="540" height="96" fill="url(#g)"/>
<rect y="96" width="540" height="7" fill="${GOLD}"/>
<circle cx="270" cy="450" r="160" fill="${TEAL}" opacity="0.03"/>
<path d="M0,785 C160,750 360,820 540,770 L540,856 L0,856 Z" fill="${TEAL}" opacity="0.2"/>
<path d="M0,808 C150,772 380,846 540,796 L540,856 L0,856 Z" fill="url(#g)"/>
</svg>`);

// Landscape 856 × 540 (mm × 10) ─ front/back backgrounds.
const L_FRONT_BG = svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 856 540"><defs>${GRAD}</defs>
<rect width="856" height="540" fill="#FFFFFF"/>
<rect width="856" height="134" fill="url(#g)"/>
<polygon points="0,0 300,0 160,134 0,134" fill="#FFFFFF" opacity="0.06"/>
<polygon points="520,0 856,0 856,90" fill="#FFFFFF" opacity="0.05"/>
<rect y="134" width="856" height="8" fill="${GOLD}"/>
<circle cx="760" cy="320" r="140" fill="${TEAL}" opacity="0.04"/>
<path d="M0,474 C240,440 600,500 856,456 L856,540 L0,540 Z" fill="${TEAL}" opacity="0.18"/>
<path d="M0,496 C220,464 620,526 856,480 L856,540 L0,540 Z" fill="url(#g)"/>
</svg>`);

const L_BACK_BG = svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 856 540"><defs>${GRAD}</defs>
<rect width="856" height="540" fill="#FFFFFF"/>
<rect width="856" height="110" fill="url(#g)"/>
<rect y="110" width="856" height="7" fill="${GOLD}"/>
<circle cx="160" cy="340" r="130" fill="${TEAL}" opacity="0.03"/>
<path d="M0,474 C240,440 600,500 856,456 L856,540 L0,540 Z" fill="${TEAL}" opacity="0.18"/>
<path d="M0,496 C220,464 620,526 856,480 L856,540 L0,540 Z" fill="url(#g)"/>
</svg>`);

// ─── element factories ────────────────────────────────────────────────────
let n = 0;
const id = (p) => `${p}-${++n}`;
const txt = (name, text, x, y, w, h, o = {}) => ({
  id: id("t"), type: "text", name, text, x, y, w, h,
  fontFamily: o.font ?? BODY_FONT, fontSize: o.size ?? 5, fontWeight: o.weight ?? 500,
  color: o.color ?? INK, align: o.align ?? "left", ...(o.valign ? { valign: o.valign } : {}),
  ...(o.upper ? { uppercase: true } : {}), ...(o.ls != null ? { letterSpacing: o.ls } : {}),
  ...(o.lh != null ? { lineHeight: o.lh } : {}), ...(o.opacity != null ? { opacity: o.opacity } : {}),
});
const fld = (name, field, x, y, w, h, o = {}) => ({ ...txt(name, "", x, y, w, h, o), type: "field", field, text: undefined });
const img = (name, src, x, y, w, h, o = {}) => ({ id: id("i"), type: "image", name, src, x, y, w, h, fit: o.fit ?? "cover", ...(o.radius != null ? { radius: o.radius } : {}) });
const rect = (name, x, y, w, h, o = {}) => ({ id: id("r"), type: "rect", name, x, y, w, h, ...(o.fill ? { fill: o.fill } : {}), ...(o.radius != null ? { radius: o.radius } : {}), ...(o.borderColor ? { borderColor: o.borderColor, borderWidth: o.borderWidth ?? 0.5 } : {}), ...(o.opacity != null ? { opacity: o.opacity } : {}) });

const SCHOOL = "NXT SCHOOL";
// White knockout of the official wordmark — sits directly on the gradient
// header with no backing chip. The wordmark IS the school name, so headers
// don't repeat it as text.
const WHITE_LOGO = "https://jqeyatzyzpchhexofiny.supabase.co/storage/v1/object/public/logos/nxt-mark-white.png";
const TAGLINE = "(Govt. Recognised)  ·  Estd. 2008";
const ADDRESS = "SVSS Sankalp, Lower Tank Bund, Hyderabad – 500080";
const PHONE = "Ph: +91 99594 37667";
const SITE = "www.nxtschools.com";
const TERMS = "•  This card is the property of NXT School.\n•  The card must be worn visibly inside the campus.\n•  It is not transferable. Misuse invites action.\n•  Loss must be reported to the school office at once.";

// Ruled Label : Value rows (labels right-aligned so the colons line up).
function rows(defs, xLabel, wLabel, xValue, wValue, yStart, rowH, hairX, hairW) {
  const els = [];
  defs.forEach((d, i) => {
    const y = yStart + i * rowH;
    els.push(txt(`lbl-${d.label}`, `${d.label} :`, xLabel, y, wLabel, rowH - 0.4, { size: 4.8, weight: 600, color: SLATE, align: "right" }));
    els.push(fld(`val-${d.label}`, d.field, xValue, y, wValue, rowH - 0.4, { size: 5.1, weight: d.weight ?? 500, color: d.color ?? INK }));
    if (d.extra) {
      els.push(txt(`lbl-${d.extra.label}`, `${d.extra.label} :`, d.extra.xл ?? d.extra.xl, y, d.extra.wl, rowH - 0.4, { size: 4.8, weight: 600, color: SLATE, align: "right" }));
      els.push(fld(`val-${d.extra.label}`, d.extra.field, d.extra.xv, y, d.extra.wv, rowH - 0.4, { size: 5.1, weight: 500, color: INK }));
    }
    els.push(rect(`hair-${i}`, hairX, y + rowH - 0.5, hairW, 0.18, { fill: HAIR }));
  });
  return els;
}

// ─── Template A: Classic Vertical — Standard (54 × 85.6) ────────────────
const P_FRONT = {
  background: P_FRONT_BG,
  elements: [
    img("logo", WHITE_LOGO, 3, 3.2, 20, 9.2, { fit: "contain" }),
    txt("tagline", TAGLINE, 25.4, 3.5, 26, 4.8, { size: 3.4, color: "#E0F2F1", lh: 1.35 }),
    txt("address", ADDRESS, 25.4, 8.2, 26, 5.4, { size: 3.4, color: "#FFFFFF", opacity: 0.92, lh: 1.35 }),
    txt("phone", PHONE, 25.4, 13.9, 26, 3, { size: 4.1, weight: 700, color: "#FDE68A" }),
    rect("ribbon", 14.5, 18.5, 25, 4.8, { fill: GOLD, radius: 2.4 }),
    txt("ribbon-label", "IDENTITY CARD", 14.5, 18.5, 25, 4.8, { font: HEAD_FONT, size: 5.2, weight: 800, color: "#FFFFFF", align: "center", valign: "middle", ls: 0.45 }),
    rect("photo-frame", 16.4, 25.2, 21.2, 26, { fill: "#FFFFFF", borderColor: NAVY, borderWidth: 0.7, radius: 1.2 }),
    img("photo", "photo_url", 17.4, 26.2, 19.2, 24, { radius: 0.8 }),
    txt("session", "SESSION 2025 – 26", 3, 52.1, 48, 2.4, { size: 3.7, weight: 700, color: GOLD_DARK, align: "center", ls: 0.4 }),
    fld("name", "full_name", 3, 54.7, 48, 5.4, { font: HEAD_FONT, size: 9.2, weight: 800, color: NAVY, align: "center", upper: true, ls: 0.12 }),
    ...rows(
      [
        { label: "Father's Name", field: "guardian_name" },
        { label: "Class", field: "class_name", extra: { label: "Sec", xl: 33.5, wl: 6, xv: 40.5, wv: 10, field: "section" } },
        { label: "Roll No", field: "roll_no" },
        { label: "D.O.B", field: "dob" },
        { label: "Mobile", field: "guardian_phone" },
      ],
      2.5, 18.3, 22.2, 29, 61.0, 3.3, 5, 44,
    ),
    txt("principal", "Principal Signature", 30, 78.0, 21, 2.6, { size: 3.9, color: MUTED, align: "center" }),
    txt("site", SITE, 3, 82.2, 48, 3, { size: 4, weight: 600, color: "#FFFFFF", align: "center" }),
  ],
};

const P_BACK = {
  background: P_BACK_BG,
  elements: [
    img("logo-b", WHITE_LOGO, 20.6, 1.0, 12.8, 5.4, { fit: "contain" }),
    txt("sub", "STUDENT IDENTITY CARD · 2025–26", 3, 6.7, 48, 2.2, { size: 3.1, color: "#E0F2FE", align: "center", ls: 0.3 }),
    txt("terms-h", "TERMS & CONDITIONS", 4, 12.4, 46, 3.4, { font: HEAD_FONT, size: 5.2, weight: 800, color: NAVY, align: "center", ls: 0.3 }),
    txt("terms", TERMS, 5.4, 16.6, 43.2, 17, { size: 3.9, color: MUTED, lh: 1.6 }),
    txt("blood-l", "Blood Group :", 5.4, 34.6, 17, 3, { size: 4.6, weight: 700, color: SLATE }),
    fld("blood-v", "blood_group", 24, 34.4, 12, 3.2, { size: 5.6, weight: 800, color: RED }),
    txt("valid-l", "Valid till :", 5.4, 38.4, 17, 3, { size: 4.6, weight: 700, color: SLATE }),
    fld("valid-v", "valid_until", 24, 38.4, 20, 3, { size: 5, weight: 600 }),
    txt("found", "If found, please return to :", 5.4, 43.6, 43, 3, { size: 4.4, weight: 700, color: NAVY }),
    txt("found-addr", `${SCHOOL}, ${ADDRESS}\n${PHONE}`, 5.4, 47, 43, 7, { size: 4, color: MUTED, lh: 1.45 }),
    { id: id("q"), type: "qr", name: "qr-verify", value: "qr_token", x: 19.8, y: 55.4, w: 14.4, h: 14.4 },
    txt("scan", "Scan to verify identity", 12, 70.2, 30, 2.4, { size: 3.7, color: FAINT, align: "center" }),
    { id: id("b"), type: "barcode", name: "barcode", barcodeType: "code128", x: 14, y: 73.4, w: 26, h: 5.6 },
    txt("site", SITE, 3, 82.2, 48, 3, { size: 4, weight: 600, color: "#FFFFFF", align: "center" }),
  ],
};

// ─── Template B: Classic Horizontal — Standard (85.6 × 54) ──────────────
const L_FRONT = {
  background: L_FRONT_BG,
  elements: [
    img("logo", WHITE_LOGO, 3, 2.4, 19.5, 9, { fit: "contain" }),
    txt("tagline", TAGLINE, 24.8, 2.9, 32, 2.4, { size: 3.5, color: "#E0F2F1" }),
    txt("address", ADDRESS, 24.8, 5.8, 32, 5, { size: 3.4, color: "#FFFFFF", opacity: 0.92, lh: 1.35 }),
    txt("phone", PHONE, 58, 2.6, 24.6, 3, { size: 4.2, weight: 700, color: "#FDE68A", align: "right" }),
    rect("ribbon", 58, 6.4, 24.6, 4.4, { fill: GOLD, radius: 2.2 }),
    txt("ribbon-label", "IDENTITY CARD", 58, 6.4, 24.6, 4.4, { font: HEAD_FONT, size: 5, weight: 800, color: "#FFFFFF", align: "center", valign: "middle", ls: 0.4 }),
    rect("photo-frame", 4, 16.6, 21, 25.6, { fill: "#FFFFFF", borderColor: NAVY, borderWidth: 0.7, radius: 1.2 }),
    img("photo", "photo_url", 5, 17.6, 19, 23.6, { radius: 0.8 }),
    txt("session", "SESSION 2025 – 26", 4, 43.4, 21, 2.6, { size: 3.6, weight: 700, color: GOLD_DARK, align: "center", ls: 0.3 }),
    { id: id("b"), type: "barcode", name: "barcode", barcodeType: "code128", x: 4.6, y: 46.6, w: 19.8, h: 5.4 },
    fld("name", "full_name", 28.4, 16.2, 53, 5.2, { font: HEAD_FONT, size: 8.8, weight: 800, color: NAVY, upper: true, ls: 0.1 }),
    rect("name-underline", 28.4, 21.8, 16, 0.7, { fill: GOLD }),
    ...rows(
      [
        { label: "Father's Name", field: "guardian_name" },
        { label: "Class", field: "class_name", extra: { label: "Sec", xl: 60, wl: 6, xv: 67, wv: 8, field: "section" } },
        { label: "Roll No", field: "roll_no" },
        { label: "D.O.B", field: "dob" },
        { label: "Blood Group", field: "blood_group", color: RED, weight: 800 },
        { label: "Mobile", field: "guardian_phone" },
      ],
      28.4, 17.6, 47.6, 35, 24.4, 3.4, 28.4, 54,
    ),
    rect("sign-line", 66, 45.8, 15, 0.25, { fill: "#94A3B8" }),
    txt("principal", "Principal", 64, 46.6, 19, 2.6, { size: 3.9, color: MUTED, align: "center" }),
    txt("site", SITE, 30, 50.4, 26, 3, { size: 4, weight: 600, color: "#FFFFFF", align: "center" }),
  ],
};

const L_BACK = {
  background: L_BACK_BG,
  elements: [
    txt("terms-h", "TERMS & CONDITIONS", 4, 3.2, 40, 4.4, { font: HEAD_FONT, size: 6.2, weight: 800, color: "#FFFFFF", ls: 0.3 }),
    txt("site-top", SITE, 52, 3.0, 30, 3, { size: 4.2, weight: 600, color: "#FFFFFF", align: "right" }),
    txt("phone", PHONE, 52, 6.6, 30, 3, { size: 4, weight: 600, color: "#FDE68A", align: "right" }),
    txt("terms", TERMS, 4.6, 14.6, 46, 20, { size: 3.9, color: MUTED, lh: 1.6 }),
    txt("found", "If found, please return to :", 4.6, 36.4, 40, 3, { size: 4.3, weight: 700, color: NAVY }),
    txt("found-addr", `${SCHOOL}, ${ADDRESS}`, 4.6, 39.8, 44, 6, { size: 3.9, color: MUTED, lh: 1.45 }),
    { id: id("q"), type: "qr", name: "qr-verify", value: "qr_token", x: 63.4, y: 14.6, w: 15, h: 15 },
    txt("scan", "Scan to verify identity", 58, 30.4, 26, 2.4, { size: 3.6, color: FAINT, align: "center" }),
    { id: id("b"), type: "barcode", name: "barcode", barcodeType: "code128", x: 58.6, y: 34.2, w: 25, h: 5.4 },
    txt("school-b", SCHOOL, 26, 50.4, 34, 3, { size: 4, weight: 600, color: "#FFFFFF", align: "center" }),
  ],
};

// ─── seed ────────────────────────────────────────────────────────────────
const school = (await q("schools?select=id&limit=1"))[0];
const NAMES = ["Classic Vertical — Standard", "Classic Horizontal — Standard"];
for (const name of NAMES) await q(`id_templates?name=eq.${encodeURIComponent(name)}`, { method: "DELETE" });

const payload = [
  { school_id: school.id, name: NAMES[0], width_mm: 54, height_mm: 85.6, dpi: 300, orientation: "portrait", front: P_FRONT, back: P_BACK, is_default: false },
  { school_id: school.id, name: NAMES[1], width_mm: 85.6, height_mm: 54, dpi: 300, orientation: "landscape", front: L_FRONT, back: L_BACK, is_default: false },
];
const inserted = await q("id_templates", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(payload) });

// Make the vertical the school default.
await q(`id_templates?school_id=eq.${school.id}`, { method: "PATCH", body: JSON.stringify({ is_default: false }) });
await q(`id_templates?id=eq.${inserted[0].id}`, { method: "PATCH", body: JSON.stringify({ is_default: true }) });

// Point two photo-bearing demo students at the new templates and reset their
// pipeline so "Generate" is available for an end-to-end render test.
const demo = [
  { ident: "NXT-2025-001", template_id: inserted[0].id }, // Ananya -> vertical
  { ident: "NXT-2025-002", template_id: inserted[1].id }, // Rahul  -> landscape
];
for (const d of demo) {
  await q(`members?identifier=eq.${d.ident}`, {
    method: "PATCH",
    body: JSON.stringify({ template_id: d.template_id, pipeline_status: "not_generated", card_pdf_url: null }),
  });
}
console.log("seeded:", inserted.map((t) => `${t.name} (${t.id})`).join(" | "));
console.log("assigned: NXT-2025-001 -> vertical, NXT-2025-002 -> landscape (reset to not_generated)");
