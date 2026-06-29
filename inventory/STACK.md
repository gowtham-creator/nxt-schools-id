# Nxt Schools ID Card Software — Recommended Stack & Plan
*Derived from the installed tooling in `INVENTORY.md`. Goal: a robust, production-grade ID-card system that maximally reuses what is already on this machine.*

## What this product needs (domain breakdown)
A school ID-card system is essentially: **records → photos → template designer → batch render → print/export**, wrapped in **auth + roles + audit**.
1. Student/staff **records** (CRUD, bulk CSV/Excel import, search, filters, class/section grouping)
2. **Photo** capture/upload + crop to passport ratio
3. **ID card template designer** (logo, fields, colors, **QR/barcode**, front/back, CR80 sizing)
4. **Batch generation** → print-ready **PDF** (CR80 cards or A4 ganged sheets w/ crop marks)
5. **Roles** (super-admin / school-admin / operator), **audit log**, multi-school option
6. **Verification** (scan QR → student profile) — optional attendance/library hooks

## Recommended stack (best fit for installed tools)
| Layer | Choice | Why (installed support) |
|-------|--------|------------------------|
| Framework | **Next.js 15 App Router + TypeScript** | `create-next-app`, `vercel` plugin, nextjs/react skills, Vercel CLI |
| UI | **Tailwind + shadcn/ui** + Radix | `shadcn` npx, frontend-design plugin, ui-ux-pro-max, magic MCP |
| Backend/DB | **Supabase** (Postgres + Auth + Storage + RLS) | supabase **MCP** + skills; Storage ideal for photos; RLS for multi-school |
| Validation | **Zod** | zod-validation-expert skill |
| ORM (optional) | Drizzle | drizzle-orm-expert skill (or Supabase client directly) |
| Card render | HTML/CSS template → **Puppeteer** (pixel-perfect PDF) | `puppeteer-core` cached; print-grade output |
| QR / Barcode | `qrcode` + `bwip-js` | standard, vector output for print |
| Excel/CSV | **SheetJS (xlsx)** | xlsx-official skill |
| Photo crop | `react-easy-crop` + browser `getUserMedia` | webcam capture in-app |
| Testing | **Playwright** | playwright MCP + skill, webapp-testing |
| Deploy | **Vercel** + Supabase cloud | both CLIs installed |
| Design assets | **Figma MCP** | pull school branding/templates directly |

**Alternative paths** (also fully supported, decide in Q&A):
- *Backend:* **Firebase** (firebase-tools installed) instead of Supabase — good if offline/Google-first.
- *Delivery:* **Desktop/offline (Electron)** or **Flutter** (cocoapods+flutter installed) for schools with poor connectivity.

## Methodology — use the installed GSD workflow
The `gsd:` (Get-Shit-Done) plugin is installed. For "robust software" we run it as the spine:
`gsd:new-project` → roadmap → `gsd:plan-phase` → `gsd:execute-phase` → `gsd:verify-work`.
Subagents (`backend-architect`, `frontend-architect`, `security-engineer`, `quality-engineer`) verify each phase.

## Proposed phased roadmap
- **Phase 0 — Scaffold:** git init, Next.js+TS+Tailwind+shadcn, Supabase project, auth, base schema (schools, users, students, templates, cards, audit_log), RLS.
- **Phase 1 — Records:** student/staff CRUD, search/filter, **bulk Excel/CSV import** with validation, photo upload+crop to Storage.
- **Phase 2 — Template Designer:** drag-drop fields, logo, colors, front/back, QR/barcode placement, CR80 (85.6×54mm) canvas, live preview.
- **Phase 3 — Batch Render & Print:** select cohort → generate → Puppeteer PDF (single CR80 + A4 ganged w/ crop marks), download/print queue.
- **Phase 4 — Roles, Audit, Multi-school:** RBAC, audit trail, optional SaaS multi-tenant via RLS.
- **Phase 5 — Verify & Ship:** Playwright E2E, security-audit pass, privacy/GDPR review, deploy to Vercel.

## Immediate next step
Lock 3 product decisions (platform, backend, primary print output, scope), then run Phase 0 scaffold.
