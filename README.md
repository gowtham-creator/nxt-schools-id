# Nxt Schools — ID Card Software

A web application for schools to manage student/staff records and design, generate, and
print **ID cards** (CR80 PVC + digital QR IDs).

## Stack
- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4** + **shadcn/ui**
- **Supabase** — Postgres, Auth, Storage, Row-Level Security
- **Rendering** — HTML/CSS templates → print-ready PDF; QR (`qrcode`) + barcode (`bwip-js`)
- **Data import** — Excel/CSV via SheetJS (`xlsx`)
- **Testing** — Playwright · **Deploy** — Vercel

## Prerequisites
- Node ≥ 20 (this machine: v24 via nvm), **pnpm**
- A Supabase project (cloud or local)

## Setup
```bash
pnpm install
cp .env.example .env.local        # then fill in your Supabase keys
# Apply the database schema:
#   • via Supabase Studio SQL editor, or
#   • supabase db push, or
#   • the Supabase MCP `apply_migration` using supabase/migrations/0001_init.sql
pnpm dev                          # http://localhost:3000
```

### First-run bootstrap
1. Sign up the first user in the app (a profile row is auto-created as `operator`).
2. Promote them and create the school — see the bootstrap SQL at the bottom of
   `supabase/migrations/0001_init.sql`.

## Project structure
```
src/
  app/                 # App Router routes (login, dashboard, verify, api)
  lib/
    supabase/          # client.ts · server.ts · middleware.ts · admin.ts
    types.ts           # domain types mirroring the DB schema
    constants.ts       # CR80 card dimensions, roles, bindable fields
    utils.ts           # cn() class merge
  middleware.ts        # session refresh + route guard
supabase/migrations/   # SQL schema + RLS (0001_init.sql)
inventory/             # this machine's tooling manifest (see INVENTORY.md, STACK.md)
```

## Scripts
| Command | Purpose |
|---------|---------|
| `pnpm dev` | Start the dev server |
| `pnpm build` | Production build |
| `pnpm start` | Run the production build |
| `pnpm lint` | ESLint |

## Roadmap
Phased build tracked in `inventory/STACK.md`: Phase 0 scaffold → 1 records & photos →
2 template designer → 3 batch render/print & digital ID → 4 roles/audit → 5 test/harden/deploy.

## Security notes
- `.env.local` is git-ignored; only `.env.example` is committed.
- `SUPABASE_SERVICE_ROLE_KEY` is **server-only** — never imported client-side (`src/lib/supabase/admin.ts`).
- Student data is PII — RLS scopes every row to the user's school; review before production.
