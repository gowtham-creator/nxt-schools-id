-- ════════════════════════════════════════════════════════════════════════
-- 0002 — Skolors-parity structure: Branches, Academic Years, per-student
-- template assignment, and the card production pipeline status.
-- Re-runnable. Apply via SQL editor or `psql`/CLI with the DB connection string.
-- ════════════════════════════════════════════════════════════════════════

-- ── Branches (School → Branch → Student) ─────────────────────────────────
create table if not exists public.branches (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null,
  email text,                         -- branch-login email (future branch auth)
  phone text,
  address text,
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, name)
);
create index if not exists branches_school_idx on public.branches(school_id);

-- ── Academic Years (first-class, selectable context) ─────────────────────
create table if not exists public.academic_years (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null,                 -- "2024-2025"
  start_date date,
  end_date date,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  unique (school_id, name)
);
create index if not exists academic_years_school_idx on public.academic_years(school_id);

-- ── Members: branch, template, academic year + card pipeline fields ──────
alter table public.members add column if not exists branch_id uuid references public.branches(id) on delete set null;
alter table public.members add column if not exists template_id uuid references public.id_templates(id) on delete set null;
alter table public.members add column if not exists academic_year_id uuid references public.academic_years(id) on delete set null;
alter table public.members add column if not exists card_pdf_url text;
alter table public.members add column if not exists card_generated_at timestamptz;
alter table public.members add column if not exists bg_removed boolean not null default false;
alter table public.members add column if not exists pipeline_status text not null default 'not_generated';
do $$ begin
  alter table public.members add constraint members_pipeline_status_chk
    check (pipeline_status in ('not_generated','generated','print_approval_pending','sent_for_printing','printed'));
exception when duplicate_object then null; end $$;
create index if not exists members_branch_idx on public.members(branch_id);
create index if not exists members_pipeline_idx on public.members(school_id, pipeline_status);

-- ── Templates: portrait flag (designer already stores width/height/orientation)
alter table public.id_templates add column if not exists is_portrait boolean not null default false;

-- classes belong to a branch too (optional link)
alter table public.classes add column if not exists branch_id uuid references public.branches(id) on delete set null;

-- ── updated_at trigger for branches ──────────────────────────────────────
create or replace trigger trg_branches_updated before update on public.branches
  for each row execute function public.set_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────
alter table public.branches enable row level security;
alter table public.academic_years enable row level security;

drop policy if exists branches_select on public.branches;
create policy branches_select on public.branches for select to authenticated using (school_id = public.auth_school_id());
drop policy if exists branches_write on public.branches;
create policy branches_write on public.branches for all to authenticated
  using (school_id = public.auth_school_id() and public.auth_role() in ('admin','super_admin'))
  with check (school_id = public.auth_school_id() and public.auth_role() in ('admin','super_admin'));

drop policy if exists years_select on public.academic_years;
create policy years_select on public.academic_years for select to authenticated using (school_id = public.auth_school_id());
drop policy if exists years_write on public.academic_years;
create policy years_write on public.academic_years for all to authenticated
  using (school_id = public.auth_school_id() and public.auth_role() in ('admin','super_admin'))
  with check (school_id = public.auth_school_id() and public.auth_role() in ('admin','super_admin'));
