// Seed v2 — six auto-branding "standard practice" Indian-school ID templates
// for EVERY school (current + future re-runs). School identity comes from FIELD
// BINDINGS (school_name / school_address / school_phone / logo), never static
// text, so each school's cards brand themselves automatically.
//
// Shared layout, parameterized by palette + kind (student/staff) + orientation:
//   STUDENT: 1 Classic Green–Blue — Portrait (school student default)
//            2 Royal Maroon — Portrait
//            3 Indigo Classic — Landscape
//            4 Sunrise — Portrait
//   STAFF:   5 Staff Navy — Portrait (school staff default)
//            6 Staff Crimson — Landscape
//
// Design synthesized from 9 real school-card references (see DESIGN.md):
// header = logo + school name + address + phone, IDENTITY CARD gold ribbon,
// framed passport-ratio (35:45) photo, SESSION line, bold name, ruled
// Label:Value rows, principal sign, wave footer; back = school-neutral terms,
// blood (red) / valid till / address / guardian (or emergency) rows, if-found
// block (school name + address + phone bindings), QR verify + Code128 barcode.
//
// Requires migration 0003 (id_templates.member_type + schools.student_template_id
// / staff_template_id). The script fails loudly if it is not applied.
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

// Migration-0003 guard: never silently drop member_type / default columns.
function failIfMigrationMissing(e) {
  const msg = String(e?.message ?? e);
  if (/member_type|student_template_id|staff_template_id/i.test(msg)) {
    console.error("\n════════════════ RUN MIGRATION 0003 FIRST ════════════════");
    console.error("The database rejected id_templates.member_type or the schools");
    console.error("student_template_id / staff_template_id columns. Apply");
    console.error("supabase/migrations/0003_school_template_defaults.sql, then re-run.");
    console.error(`Original error: ${msg}\n`);
    process.exit(1);
  }
}

// ─── shared colors / fonts ────────────────────────────────────────────────
const NAVY = "#1E3A8A";
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

// School-neutral terms — every school gets the same wording.
const TERMS =
  "•  This card is the property of the issuing school.\n•  The card must be worn visibly inside the campus.\n•  It is not transferable. Misuse invites action.\n•  Loss must be reported to the school office at once.";
const SESSION = "SESSION 2025 – 26";

// ─── palettes (c1→c2→c3 gradient; head = heading/name/frame color) ───────
const PALETTES = {
  greenBlue: { c1: "#1E3A8A", c2: "#0F766E", c3: "#059669", ribbon: GOLD, ribbonText: "#FFFFFF", head: NAVY, rule: GOLD, sub: GOLD_DARK, headerAccent: "#FDE68A" },
  maroon: { c1: "#7F1D1D", c2: "#B91C1C", c3: "#DC2626", ribbon: GOLD, ribbonText: "#FFFFFF", head: "#7F1D1D", rule: GOLD, sub: GOLD_DARK, headerAccent: "#FDE68A" },
  indigo: { c1: "#1E3A8A", c2: "#4338CA", c3: "#6D28D9", ribbon: GOLD, ribbonText: "#FFFFFF", head: NAVY, rule: GOLD, sub: GOLD_DARK, headerAccent: "#FDE68A" },
  sunrise: { c1: "#C2410C", c2: "#EA580C", c3: "#F59E0B", ribbon: NAVY, ribbonText: "#FFFFFF", head: NAVY, rule: NAVY, sub: NAVY, headerAccent: "#FFFFFF" },
  staffNavy: { c1: "#0F172A", c2: "#1E3A8A", c3: "#1D4ED8", ribbon: GOLD, ribbonText: "#FFFFFF", head: "#1D4ED8", rule: GOLD, sub: GOLD_DARK, headerAccent: "#FDE68A" },
  staffCrimson: { c1: "#881337", c2: "#9F1239", c3: "#BE123C", ribbon: GOLD, ribbonText: "#FFFFFF", head: "#881337", rule: GOLD, sub: GOLD_DARK, headerAccent: "#FDE68A" },
};

// Match the proven Aurora background format exactly: plain svg+xml prefix,
// single-quoted attributes, and 10x-scaled integer-ish viewBox units.
const svgUrl = (svg) =>
  `data:image/svg+xml,${encodeURIComponent(svg.replace(/"/g, "'").replace(/\s+/g, " ").trim())}`;

const grad = (p) => `<linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="${p.c1}"/><stop offset="0.55" stop-color="${p.c2}"/><stop offset="1" stop-color="${p.c3}"/>
</linearGradient>`;

// Portrait 540 × 856 (mm × 10) ─ front background: header band + rule + waves.
const pFrontBg = (p) => svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 540 856"><defs>${grad(p)}</defs>
<rect width="540" height="856" fill="#FFFFFF"/>
<rect width="540" height="205" fill="url(#g)"/>
<polygon points="0,0 220,0 80,205 0,205" fill="#FFFFFF" opacity="0.06"/>
<polygon points="300,0 540,0 540,140" fill="#FFFFFF" opacity="0.05"/>
<rect y="205" width="540" height="9" fill="${p.rule}"/>
<circle cx="270" cy="470" r="170" fill="${p.c2}" opacity="0.035"/>
<path d="M0,785 C160,750 360,820 540,770 L540,856 L0,856 Z" fill="${p.c2}" opacity="0.2"/>
<path d="M0,808 C150,772 380,846 540,796 L540,856 L0,856 Z" fill="url(#g)"/>
</svg>`);

// Portrait back background: slim band + rule + waves.
const pBackBg = (p) => svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 540 856"><defs>${grad(p)}</defs>
<rect width="540" height="856" fill="#FFFFFF"/>
<rect width="540" height="96" fill="url(#g)"/>
<rect y="96" width="540" height="7" fill="${p.rule}"/>
<circle cx="270" cy="450" r="160" fill="${p.c2}" opacity="0.03"/>
<path d="M0,785 C160,750 360,820 540,770 L540,856 L0,856 Z" fill="${p.c2}" opacity="0.2"/>
<path d="M0,808 C150,772 380,846 540,796 L540,856 L0,856 Z" fill="url(#g)"/>
</svg>`);

// Landscape 856 × 540 (mm × 10) ─ front/back backgrounds.
const lFrontBg = (p) => svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 856 540"><defs>${grad(p)}</defs>
<rect width="856" height="540" fill="#FFFFFF"/>
<rect width="856" height="134" fill="url(#g)"/>
<polygon points="0,0 300,0 160,134 0,134" fill="#FFFFFF" opacity="0.06"/>
<polygon points="520,0 856,0 856,90" fill="#FFFFFF" opacity="0.05"/>
<rect y="134" width="856" height="8" fill="${p.rule}"/>
<circle cx="760" cy="320" r="140" fill="${p.c2}" opacity="0.04"/>
<path d="M0,474 C240,440 600,500 856,456 L856,540 L0,540 Z" fill="${p.c2}" opacity="0.18"/>
<path d="M0,496 C220,464 620,526 856,480 L856,540 L0,540 Z" fill="url(#g)"/>
</svg>`);

const lBackBg = (p) => svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 856 540"><defs>${grad(p)}</defs>
<rect width="856" height="540" fill="#FFFFFF"/>
<rect width="856" height="110" fill="url(#g)"/>
<rect y="110" width="856" height="7" fill="${p.rule}"/>
<circle cx="160" cy="340" r="130" fill="${p.c2}" opacity="0.03"/>
<path d="M0,474 C240,440 600,500 856,456 L856,540 L0,540 Z" fill="${p.c2}" opacity="0.18"/>
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

// Ruled Label : Value rows (labels right-aligned so the colons line up).
function rows(defs, xLabel, wLabel, xValue, wValue, yStart, rowH, hairX, hairW, o = {}) {
  const labelSize = o.labelSize ?? 4.8;
  const valueSize = o.valueSize ?? 5.1;
  const els = [];
  defs.forEach((d, i) => {
    const y = yStart + i * rowH;
    els.push(txt(`lbl-${d.label}`, `${d.label} :`, xLabel, y, wLabel, rowH - 0.4, { size: labelSize, weight: 600, color: SLATE, align: "right" }));
    els.push(fld(`val-${d.label}`, d.field, xValue, y, wValue, rowH - 0.4, { size: valueSize, weight: d.weight ?? 500, color: d.color ?? INK }));
    if (d.extra) {
      els.push(txt(`lbl-${d.extra.label}`, `${d.extra.label} :`, d.extra.xl, y, d.extra.wl, rowH - 0.4, { size: labelSize, weight: 600, color: SLATE, align: "right" }));
      els.push(fld(`val-${d.extra.label}`, d.extra.field, d.extra.xv, y, d.extra.wv, rowH - 0.4, { size: valueSize, weight: 500, color: INK }));
    }
    els.push(rect(`hair-${i}`, hairX, y + rowH - 0.5, hairW, 0.18, { fill: HAIR }));
  });
  return els;
}

// ─── per-kind row definitions ─────────────────────────────────────────────
const ribbonLabel = (kind) => (kind === "staff" ? "STAFF IDENTITY CARD" : "IDENTITY CARD");

const frontRows = (kind, orient) =>
  kind === "staff"
    ? [
        { label: "Employee ID", field: "identifier" },
        { label: "Designation", field: "designation" },
        { label: "Department", field: "department" },
        { label: "D.O.B", field: "dob" },
        { label: "Mobile", field: "phone" },
      ]
    : [
        { label: "Father's Name", field: "guardian_name" },
        {
          label: "Class", field: "class_name",
          extra: orient === "portrait"
            ? { label: "Sec", xl: 33.5, wl: 6, xv: 40.5, wv: 10, field: "section" }
            : { label: "Sec", xl: 60, wl: 6, xv: 67, wv: 8, field: "section" },
        },
        { label: "Roll No", field: "roll_no" },
        { label: "D.O.B", field: "dob" },
        { label: "Mobile", field: "guardian_phone" },
      ];

const backRows = (kind) =>
  kind === "staff"
    ? [
        { label: "Blood Group", field: "blood_group", color: RED, weight: 800 },
        { label: "Valid till", field: "valid_until" },
        { label: "Address", field: "address" },
        { label: "Emergency Contact", field: "guardian_phone" },
        { label: "School Office", field: "school_phone" },
      ]
    : [
        { label: "Blood Group", field: "blood_group", color: RED, weight: 800 },
        { label: "Valid till", field: "valid_until" },
        { label: "Address", field: "address" },
        { label: "Guardian", field: "guardian_name" },
        { label: "Guardian Ph", field: "guardian_phone" },
        { label: "School Office", field: "school_phone" },
      ];

// If-found block: school bindings stacked (name + address + "Ph :" + phone).
function ifFoundBlock(pal, x, w, y, o = {}) {
  const els = [
    txt("found", "If found, please return to :", x, y, w, 2.8, { size: o.labelSize ?? 4.1, weight: 700, color: pal.head }),
    fld("found-school", "school_name", x, y + 2.9, w, 3, { size: o.nameSize ?? 4, weight: 700, color: INK }),
    fld("found-address", "school_address", x, y + 6.0, w, 4.8, { size: o.addrSize ?? 3.4, color: MUTED, lh: 1.35 }),
    txt("found-ph-l", "Ph :", x, y + 11.0, 4.4, 2.6, { size: o.phSize ?? 3.6, weight: 700, color: SLATE }),
    fld("found-ph-v", "school_phone", x + 4.8, y + 11.0, w - 4.8, 2.6, { size: o.phSize ?? 3.6, weight: 600, color: INK }),
  ];
  return { els, end: y + 13.6 };
}

// ─── portrait front (54 × 85.6) ───────────────────────────────────────────
function portraitFront(pal, kind) {
  const ribbonX = kind === "staff" ? 12 : 14.5;
  const ribbonW = kind === "staff" ? 30 : 25;
  return {
    background: pFrontBg(pal),
    elements: [
      img("logo", "logo", 3, 3.0, 11, 11, { fit: "contain" }),
      fld("school-name", "school_name", 15.4, 3.4, 35.6, 6.6, { font: HEAD_FONT, size: 5.3, weight: 800, color: "#FFFFFF", upper: true, lh: 1.15 }),
      fld("school-address", "school_address", 15.4, 10.3, 35.6, 4.8, { size: 3.1, color: "#FFFFFF", opacity: 0.92, lh: 1.3 }),
      txt("ph-label", "Ph :", 15.4, 15.4, 4.4, 2.8, { size: 3.7, weight: 700, color: pal.headerAccent }),
      fld("school-phone", "school_phone", 20.2, 15.4, 30.8, 2.8, { size: 3.7, weight: 700, color: pal.headerAccent }),
      rect("ribbon", ribbonX, 18.5, ribbonW, 4.8, { fill: pal.ribbon, radius: 2.4 }),
      txt("ribbon-label", ribbonLabel(kind), ribbonX, 18.5, ribbonW, 4.8, { font: HEAD_FONT, size: kind === "staff" ? 4.6 : 5.2, weight: 800, color: pal.ribbonText, align: "center", valign: "middle", ls: 0.45 }),
      // Passport-ratio (35:45) framed photo.
      rect("photo-frame", 16.4, 25.2, 21.2, 28, { fill: "#FFFFFF", borderColor: pal.head, borderWidth: 0.7, radius: 1.2 }),
      img("photo", "photo_url", 17.4, 26.2, 19.2, 24.7, { radius: 0.8 }),
      txt("session", SESSION, 3, 54.0, 48, 2.4, { size: 3.7, weight: 700, color: pal.sub, align: "center", ls: 0.4 }),
      fld("name", "full_name", 3, 56.6, 48, 5.2, { font: HEAD_FONT, size: 8.8, weight: 800, color: pal.head, align: "center", upper: true, ls: 0.12 }),
      ...rows(frontRows(kind, "portrait"), 2.5, 18.3, 22.2, 29, 62.6, 3.05, 5, 44),
      txt("principal", "Principal Signature", 30, 78.4, 21, 2.6, { size: 3.9, color: MUTED, align: "center" }),
      fld("footer-school", "school_name", 3, 82.1, 48, 2.8, { size: 3.6, weight: 700, color: "#FFFFFF", align: "center", upper: true }),
    ],
  };
}

// ─── portrait back (54 × 85.6) ────────────────────────────────────────────
function portraitBack(pal, kind) {
  const defs = backRows(kind);
  const rowsStart = 24.4;
  const rowH = 3.3;
  let y = rowsStart + defs.length * rowH + 1.5;
  const found = ifFoundBlock(pal, 4.8, 44, y);
  y = found.end + 0.4;
  const qrY = y;
  const scanY = qrY + 13.2;
  const barY = scanY + 2.9;
  return {
    background: pBackBg(pal),
    elements: [
      img("logo-b", "logo", 3.2, 1.3, 7.2, 7.0, { fit: "contain" }),
      fld("school-name-b", "school_name", 11.4, 1.5, 39.4, 6.6, { font: HEAD_FONT, size: 4.2, weight: 800, color: "#FFFFFF", upper: true, lh: 1.15, valign: "middle" }),
      txt("terms-h", "TERMS & CONDITIONS", 4, 11.2, 46, 3.2, { font: HEAD_FONT, size: 4.8, weight: 800, color: pal.head, align: "center", ls: 0.3 }),
      txt("terms", TERMS, 4.8, 14.8, 44.4, 8.6, { size: 3.5, color: MUTED, lh: 1.5 }),
      ...rows(defs, 2.6, 18.4, 22.6, 28.4, rowsStart, rowH, 5, 44, { labelSize: 4.4, valueSize: 4.7 }),
      ...found.els,
      { id: id("q"), type: "qr", name: "qr-verify", value: "qr_token", x: 20.6, y: qrY, w: 12.8, h: 12.8 },
      txt("scan", "Scan to verify identity", 12, scanY, 30, 2.2, { size: 3.4, color: FAINT, align: "center" }),
      { id: id("b"), type: "barcode", name: "barcode", barcodeType: "code128", x: 14, y: barY, w: 26, h: 5 },
    ],
  };
}

// ─── landscape front (85.6 × 54) ──────────────────────────────────────────
function landscapeFront(pal, kind) {
  const ribbonX = kind === "staff" ? 54.8 : 58;
  const ribbonW = kind === "staff" ? 27.8 : 24.6;
  return {
    background: lFrontBg(pal),
    elements: [
      img("logo", "logo", 3, 2.4, 10.4, 8.8, { fit: "contain" }),
      fld("school-name", "school_name", 15, 2.6, 38, 5.2, { font: HEAD_FONT, size: 4.9, weight: 800, color: "#FFFFFF", upper: true, lh: 1.1 }),
      fld("school-address", "school_address", 15, 8.1, 38, 4.6, { size: 3.1, color: "#FFFFFF", opacity: 0.92, lh: 1.3 }),
      txt("ph-label", "Ph :", 57.6, 2.7, 5, 2.8, { size: 3.7, weight: 700, color: pal.headerAccent, align: "right" }),
      fld("school-phone", "school_phone", 63, 2.7, 19.6, 2.8, { size: 3.7, weight: 700, color: pal.headerAccent }),
      rect("ribbon", ribbonX, 6.4, ribbonW, 4.4, { fill: pal.ribbon, radius: 2.2 }),
      txt("ribbon-label", ribbonLabel(kind), ribbonX, 6.4, ribbonW, 4.4, { font: HEAD_FONT, size: kind === "staff" ? 4.4 : 5, weight: 800, color: pal.ribbonText, align: "center", valign: "middle", ls: 0.4 }),
      // Passport-ratio (35:45) framed photo.
      rect("photo-frame", 4, 15.8, 20, 26.6, { fill: "#FFFFFF", borderColor: pal.head, borderWidth: 0.7, radius: 1.2 }),
      img("photo", "photo_url", 5, 16.8, 18, 23.1, { radius: 0.8 }),
      txt("session", SESSION, 4, 43.2, 20, 2.4, { size: 3.5, weight: 700, color: pal.sub, align: "center", ls: 0.3 }),
      { id: id("b"), type: "barcode", name: "barcode", barcodeType: "code128", x: 4.6, y: 46.4, w: 18.8, h: 5.2 },
      fld("name", "full_name", 28.4, 16.2, 53, 5.2, { font: HEAD_FONT, size: 8.8, weight: 800, color: pal.head, upper: true, ls: 0.1 }),
      rect("name-underline", 28.4, 21.8, 16, 0.7, { fill: pal.ribbon }),
      ...rows(frontRows(kind, "landscape"), 28.4, 17.6, 47.6, 35, 24.4, 3.6, 28.4, 54),
      rect("sign-line", 66, 45.8, 15, 0.25, { fill: "#94A3B8" }),
      txt("principal", "Principal", 64, 46.6, 19, 2.6, { size: 3.9, color: MUTED, align: "center" }),
      fld("footer-school", "school_name", 22, 50.3, 42, 2.9, { size: 3.6, weight: 700, color: "#FFFFFF", align: "center", upper: true }),
    ],
  };
}

// ─── landscape back (85.6 × 54) ───────────────────────────────────────────
function landscapeBack(pal, kind) {
  const defs = backRows(kind);
  const found = ifFoundBlock(pal, 51.6, 31, 35.4, { labelSize: 3.6, nameSize: 3.5, addrSize: 3.1, phSize: 3.3 });
  return {
    background: lBackBg(pal),
    elements: [
      img("logo-b", "logo", 3, 1.6, 8, 7.8, { fit: "contain" }),
      fld("school-name-b", "school_name", 12.4, 1.8, 45, 7.4, { font: HEAD_FONT, size: 4.6, weight: 800, color: "#FFFFFF", upper: true, lh: 1.15, valign: "middle" }),
      txt("kind-label", ribbonLabel(kind), 59, 4.2, 23.6, 2.6, { size: 3.2, weight: 700, color: pal.headerAccent, align: "right", ls: 0.3 }),
      txt("terms-h", "TERMS & CONDITIONS", 4.4, 12.6, 43.6, 2.8, { font: HEAD_FONT, size: 4.2, weight: 800, color: pal.head, ls: 0.3 }),
      txt("terms", TERMS, 4.4, 15.8, 43.6, 8, { size: 3.4, color: MUTED, lh: 1.5 }),
      ...rows(defs, 4.4, 17.2, 23.2, 24.8, 24.8, 3.2, 4.4, 43.6, { labelSize: 4.4, valueSize: 4.7 }),
      { id: id("q"), type: "qr", name: "qr-verify", value: "qr_token", x: 60.8, y: 13.0, w: 12.6, h: 12.6 },
      txt("scan", "Scan to verify identity", 54.6, 26.1, 25, 2.2, { size: 3.4, color: FAINT, align: "center" }),
      { id: id("b"), type: "barcode", name: "barcode", barcodeType: "code128", x: 57.3, y: 29.3, w: 19.6, h: 4.6 },
      ...found.els,
      fld("footer-school", "school_name", 22, 50.3, 42, 2.9, { size: 3.6, weight: 700, color: "#FFFFFF", align: "center", upper: true }),
    ],
  };
}

// ─── six template bodies (school_id added per school) ─────────────────────
const STUDENT_DEFAULT = "Classic Green–Blue — Portrait";
const STAFF_DEFAULT = "Staff Navy — Portrait";

const SPECS = [
  { name: STUDENT_DEFAULT, pal: PALETTES.greenBlue, kind: "student", orient: "portrait" },
  { name: "Royal Maroon — Portrait", pal: PALETTES.maroon, kind: "student", orient: "portrait" },
  { name: "Indigo Classic — Landscape", pal: PALETTES.indigo, kind: "student", orient: "landscape" },
  { name: "Sunrise — Portrait", pal: PALETTES.sunrise, kind: "student", orient: "portrait" },
  { name: STAFF_DEFAULT, pal: PALETTES.staffNavy, kind: "staff", orient: "portrait" },
  { name: "Staff Crimson — Landscape", pal: PALETTES.staffCrimson, kind: "staff", orient: "landscape" },
];

const bodies = SPECS.map((s) => ({
  name: s.name,
  width_mm: s.orient === "portrait" ? 54 : 85.6,
  height_mm: s.orient === "portrait" ? 85.6 : 54,
  dpi: 300,
  orientation: s.orient,
  member_type: s.kind,
  front: s.orient === "portrait" ? portraitFront(s.pal, s.kind) : landscapeFront(s.pal, s.kind),
  back: s.orient === "portrait" ? portraitBack(s.pal, s.kind) : landscapeBack(s.pal, s.kind),
  is_default: false,
}));

const NAMES = SPECS.map((s) => s.name);
// PostgREST in.() list — each name double-quoted (spaces/dashes), then URL-encoded.
const inList = NAMES.map((x) => encodeURIComponent(`"${x}"`)).join(",");

// ─── seed every school (re-runnable; Aurora/Horizon/'Student ID' untouched) ─
const schools = await q("schools?select=id,name&order=created_at");
if (!schools?.length) {
  console.error("No schools found — nothing to seed.");
  process.exit(1);
}

for (const school of schools) {
  // Re-runnable: remove only our six named templates for this school.
  await q(`id_templates?school_id=eq.${school.id}&name=in.(${inList})`, { method: "DELETE" });

  const payload = bodies.map((b) => ({ school_id: school.id, ...b }));
  let inserted;
  try {
    inserted = await q("id_templates", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(payload) });
  } catch (e) {
    failIfMigrationMissing(e);
    throw e;
  }

  const byName = new Map(inserted.map((t) => [t.name, t.id]));
  const studentId = byName.get(STUDENT_DEFAULT);
  const staffId = byName.get(STAFF_DEFAULT);

  // Legacy fallback: is_default=true on the student portrait only.
  await q(`id_templates?school_id=eq.${school.id}`, { method: "PATCH", body: JSON.stringify({ is_default: false }) });
  await q(`id_templates?id=eq.${studentId}`, { method: "PATCH", body: JSON.stringify({ is_default: true }) });

  // School defaults per member type (migration 0003 columns).
  try {
    await q(`schools?id=eq.${school.id}`, { method: "PATCH", body: JSON.stringify({ student_template_id: studentId, staff_template_id: staffId }) });
  } catch (e) {
    failIfMigrationMissing(e);
    throw e;
  }

  // Clear stale per-member overrides so the school defaults govern.
  await q(`members?school_id=eq.${school.id}`, { method: "PATCH", body: JSON.stringify({ template_id: null }) });

  console.log(
    `✓ ${school.name ?? school.id} — 6 templates seeded | student default: ${STUDENT_DEFAULT} (${studentId}) | staff default: ${STAFF_DEFAULT} (${staffId}) | member overrides cleared`,
  );
}

console.log(`done: ${schools.length} school(s) × ${NAMES.length} templates`);
