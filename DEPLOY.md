# Deploying to Vercel

A concise, repeatable guide to ship **Nxt Schools ID Card** (Next.js 16 App Router
+ Supabase) to production on Vercel. Follow top to bottom the first time; skip to
the smoke test on redeploys.

---

## 1. Prerequisites

- A **Supabase** project (Postgres + Auth + Storage).
- A **Vercel** account with this repo imported as a project.
- The repo builds locally (`npm install && npm run build`) before you push.

The app renders ID cards with headless Chromium. `next.config.ts` already keeps
those native deps out of the bundler:

```ts
serverExternalPackages: ["puppeteer-core", "@sparticuz/chromium"],
```

Do **not** remove this — it lets the server code `require()` the Chromium binary
at runtime. On Vercel the bundled `@sparticuz/chromium` (v149) is used
automatically; locally `puppeteer-core` launches your system Chrome. See
`src/lib/render/browser.ts`.

---

## 2. Supabase setup

1. **Run the migrations** (in order) against your project's database:
   - `supabase/migrations/0001_init.sql` — tables, RLS policies, **and the three
     storage buckets** (`photos`, `logos` public; `cards` private) with their
     `storage.objects` policies.
   - `supabase/migrations/0002_branches_years_pipeline.sql` — branches, academic
     years, and the card pipeline status column.

   Apply via the Supabase SQL editor, the CLI (`supabase db push`), or MCP
   `apply_migration`.

2. **Verify storage buckets** exist after migrating (Dashboard → Storage). If for
   any reason they weren't created, add them manually with these exact ids:
   - `photos` — **public**
   - `logos` — **public**
   - `cards` — **private** (served only via short-lived signed URLs)

3. **RLS** is enabled by the migrations. Every table is scoped by `school_id`, and
   the `cards` bucket is readable only by authenticated users. Don't disable RLS.

4. Grab your keys (Dashboard → Settings → API, or MCP `get_project_url` /
   `get_publishable_keys`): project URL, anon/publishable key, and the
   service-role/secret key.

---

## 3. Environment variables (Vercel → Settings → Environment Variables)

Set these for **Production** (and Preview if you use preview deploys). Values are
documented in `.env.example` — copy the keys, fill in real values here. Never
commit real secrets.

| Variable | Scope | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Anon/publishable key for the browser + RLS client |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server only** | Admin client for bulk import + card render/upload. Never prefix with `NEXT_PUBLIC_`. |
| `NEXT_PUBLIC_APP_URL` | Public | Deployed base URL, e.g. `https://ids.yourschool.com`. Builds the **QR verify links** printed on ID cards (`src/lib/card/resolve.ts`). No trailing slash. |
| `CHROME_PATH` | **Do not set on Vercel** | Local-only override for system Chrome. Serverless uses bundled `@sparticuz/chromium`. |

After the first deploy, come back and set `NEXT_PUBLIC_APP_URL` to the real
Vercel domain (or your custom domain), then redeploy so QR codes point at prod.

---

## 4. Runtime & function limits (card rendering)

- Card generation runs as a **Server Action** on the Members page. Launching
  Chromium cold + rendering the CR80 PDF can exceed Vercel's default function
  timeout, so `src/app/(app)/members/page.tsx` sets:

  ```ts
  export const maxDuration = 60; // seconds
  ```

- These routes must run on the **Node.js runtime** (the default) — Chromium can't
  run on the Edge runtime. Do not add `export const runtime = "edge"` to any
  route that renders cards.
- On Vercel Hobby, functions cap at 60s; Pro allows longer if you ever need it.
  Bulk generation renders sequentially through a single warm browser, so very
  large batches may be better run in smaller chunks.

---

## 5. Deploy

1. Push to your default branch (or open a PR for a Preview deploy).
2. Vercel runs `next build` and deploys. No custom build command needed.
3. Confirm the build succeeded and the function region is near your Supabase
   region for lower latency.

---

## 6. Post-deploy smoke test

Run through this checklist on the live URL:

- [ ] **Auth** — sign in; unauthenticated visits to `/members` redirect to `/login`.
- [ ] **Members list** — `/members` loads records; search + type/status tabs filter.
- [ ] **Create** — add a member; it appears in the list.
- [ ] **Photo upload** — upload a member photo; it stores in the `photos` bucket and displays.
- [ ] **Template** — a default ID template exists (or create one) for the school.
- [ ] **Generate card** — click Generate on a member. Expect a redirect to
      `/members?ok=Card+generated` and status → **generated**. On failure you get
      `/members?error=Card+generation+failed` (not a 500) — check function logs.
- [ ] **Card storage** — the PDF lands in the private `cards` bucket and the row's
      `card_pdf_url` opens (signed URL, ~7-day expiry).
- [ ] **Bulk generate** — select several members, bulk-generate; ok/failed counts return.
- [ ] **QR verify** — scan/open the QR link on a rendered card; it resolves to the
      public verify page on `NEXT_PUBLIC_APP_URL` (confirm the domain is prod, not localhost).
- [ ] **Pipeline** — advance a card (generated → … → printed) and reset works.
- [ ] **Logs** — Vercel → Deployments → Functions shows no unhandled exceptions;
      no card action exceeds `maxDuration`.

If card generation times out or 500s, check: `maxDuration` is present, the route
is Node (not Edge), `serverExternalPackages` is intact, and
`SUPABASE_SERVICE_ROLE_KEY` is set for the server environment.
