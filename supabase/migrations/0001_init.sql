-- ════════════════════════════════════════════════════════════════════════
-- Nxt Schools ID Card Software — initial schema (single-school v1, multi-school ready)
-- Apply with the Supabase MCP `apply_migration`, the SQL editor, or `supabase db push`.
-- Re-runnable: enums/tables/indexes guarded, policies dropped-then-created.
-- ════════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- ── Enums ────────────────────────────────────────────────────────────────
do $$ begin create type member_type   as enum ('student','staff');                exception when duplicate_object then null; end $$;
do $$ begin create type member_status as enum ('active','inactive','archived');   exception when duplicate_object then null; end $$;
do $$ begin create type app_role      as enum ('super_admin','admin','operator'); exception when duplicate_object then null; end $$;
do $$ begin create type card_status   as enum ('pending','generated','printed','revoked'); exception when duplicate_object then null; end $$;

-- ── updated_at helper ────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ── Tables ───────────────────────────────────────────────────────────────
create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  short_name text,
  logo_url text,
  address text,
  phone text,
  email text,
  academic_year text,
  primary_color text default '#1e3a8a',
  secondary_color text default '#f59e0b',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_users (
  id uuid primary key references auth.users(id) on delete cascade,
  school_id uuid references public.schools(id) on delete set null,
  full_name text,
  role app_role not null default 'operator',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null,
  section text,
  academic_year text,
  created_at timestamptz not null default now(),
  unique (school_id, name, section, academic_year)
);

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  member_type member_type not null default 'student',
  identifier text,                          -- admission no (student) / employee id (staff)
  first_name text not null,
  last_name text,
  photo_url text,
  dob date,
  gender text,
  blood_group text,
  class_id uuid references public.classes(id) on delete set null,
  roll_no text,
  designation text,
  department text,
  guardian_name text,
  guardian_phone text,
  phone text,
  email text,
  address text,
  valid_from date,
  valid_until date,
  status member_status not null default 'active',
  qr_token uuid not null default gen_random_uuid(),   -- public verification token
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, member_type, identifier)
);
create index if not exists members_school_idx on public.members(school_id);
create index if not exists members_class_idx  on public.members(class_id);
create index if not exists members_name_idx   on public.members(school_id, last_name, first_name);
create unique index if not exists members_qr_token_idx on public.members(qr_token);

create table if not exists public.id_templates (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null,
  width_mm numeric not null default 85.6,
  height_mm numeric not null default 54.0,
  dpi int not null default 300,
  orientation text not null default 'landscape',
  front jsonb not null default '{"background":null,"elements":[]}'::jsonb,
  back  jsonb not null default '{"background":null,"elements":[]}'::jsonb,
  is_default boolean not null default false,
  created_by uuid references public.app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists id_templates_school_idx on public.id_templates(school_id);

create table if not exists public.card_batches (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text,
  template_id uuid references public.id_templates(id) on delete set null,
  created_by uuid references public.app_users(id) on delete set null,
  status card_status not null default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists public.generated_cards (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  template_id uuid references public.id_templates(id) on delete set null,
  batch_id uuid references public.card_batches(id) on delete set null,
  status card_status not null default 'generated',
  pdf_url text,
  generated_by uuid references public.app_users(id) on delete set null,
  generated_at timestamptz not null default now()
);
create index if not exists generated_cards_member_idx on public.generated_cards(member_id);
create index if not exists generated_cards_batch_idx  on public.generated_cards(batch_id);

create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  school_id uuid references public.schools(id) on delete set null,
  actor_id uuid references public.app_users(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id text,
  changes jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_log_school_idx on public.audit_log(school_id, created_at desc);

-- ── updated_at triggers (PG14+ create-or-replace) ────────────────────────
create or replace trigger trg_schools_updated      before update on public.schools      for each row execute function public.set_updated_at();
create or replace trigger trg_app_users_updated    before update on public.app_users    for each row execute function public.set_updated_at();
create or replace trigger trg_members_updated      before update on public.members      for each row execute function public.set_updated_at();
create or replace trigger trg_id_templates_updated before update on public.id_templates for each row execute function public.set_updated_at();

-- ── Auth helpers (SECURITY DEFINER → avoids RLS recursion) ───────────────
create or replace function public.auth_school_id() returns uuid
  language sql stable security definer set search_path = public as
$$ select school_id from public.app_users where id = auth.uid() $$;

create or replace function public.auth_role() returns app_role
  language sql stable security definer set search_path = public as
$$ select role from public.app_users where id = auth.uid() $$;

-- ── Row Level Security ───────────────────────────────────────────────────
alter table public.schools         enable row level security;
alter table public.app_users       enable row level security;
alter table public.classes         enable row level security;
alter table public.members         enable row level security;
alter table public.id_templates    enable row level security;
alter table public.card_batches    enable row level security;
alter table public.generated_cards enable row level security;
alter table public.audit_log       enable row level security;

drop policy if exists schools_select on public.schools;
create policy schools_select on public.schools for select to authenticated using (id = public.auth_school_id());
drop policy if exists schools_update on public.schools;
create policy schools_update on public.schools for update to authenticated
  using (id = public.auth_school_id() and public.auth_role() in ('admin','super_admin'));

drop policy if exists app_users_select on public.app_users;
create policy app_users_select on public.app_users for select to authenticated using (school_id = public.auth_school_id());
drop policy if exists app_users_manage on public.app_users;
create policy app_users_manage on public.app_users for all to authenticated
  using (school_id = public.auth_school_id() and public.auth_role() in ('admin','super_admin'))
  with check (school_id = public.auth_school_id() and public.auth_role() in ('admin','super_admin'));

drop policy if exists classes_select on public.classes;
create policy classes_select on public.classes for select to authenticated using (school_id = public.auth_school_id());
drop policy if exists classes_write on public.classes;
create policy classes_write on public.classes for all to authenticated
  using (school_id = public.auth_school_id() and public.auth_role() in ('operator','admin','super_admin'))
  with check (school_id = public.auth_school_id() and public.auth_role() in ('operator','admin','super_admin'));

drop policy if exists members_select on public.members;
create policy members_select on public.members for select to authenticated using (school_id = public.auth_school_id());
drop policy if exists members_write on public.members;
create policy members_write on public.members for all to authenticated
  using (school_id = public.auth_school_id() and public.auth_role() in ('operator','admin','super_admin'))
  with check (school_id = public.auth_school_id() and public.auth_role() in ('operator','admin','super_admin'));

drop policy if exists templates_select on public.id_templates;
create policy templates_select on public.id_templates for select to authenticated using (school_id = public.auth_school_id());
drop policy if exists templates_write on public.id_templates;
create policy templates_write on public.id_templates for all to authenticated
  using (school_id = public.auth_school_id() and public.auth_role() in ('admin','super_admin'))
  with check (school_id = public.auth_school_id() and public.auth_role() in ('admin','super_admin'));

drop policy if exists batches_select on public.card_batches;
create policy batches_select on public.card_batches for select to authenticated using (school_id = public.auth_school_id());
drop policy if exists batches_write on public.card_batches;
create policy batches_write on public.card_batches for all to authenticated
  using (school_id = public.auth_school_id() and public.auth_role() in ('operator','admin','super_admin'))
  with check (school_id = public.auth_school_id() and public.auth_role() in ('operator','admin','super_admin'));

drop policy if exists cards_select on public.generated_cards;
create policy cards_select on public.generated_cards for select to authenticated using (school_id = public.auth_school_id());
drop policy if exists cards_write on public.generated_cards;
create policy cards_write on public.generated_cards for all to authenticated
  using (school_id = public.auth_school_id() and public.auth_role() in ('operator','admin','super_admin'))
  with check (school_id = public.auth_school_id() and public.auth_role() in ('operator','admin','super_admin'));

drop policy if exists audit_select on public.audit_log;
create policy audit_select on public.audit_log for select to authenticated
  using (school_id = public.auth_school_id() and public.auth_role() in ('admin','super_admin'));
drop policy if exists audit_insert on public.audit_log;
create policy audit_insert on public.audit_log for insert to authenticated
  with check (school_id = public.auth_school_id());

-- ── Public card verification (no PII table exposure) ─────────────────────
create or replace function public.verify_card(token uuid)
returns table (
  full_name text, member_type member_type, identifier text, photo_url text,
  class_name text, section text, valid_until date, status member_status,
  school_name text, school_logo text
)
language sql stable security definer set search_path = public as $$
  select
    btrim(coalesce(m.first_name,'') || ' ' || coalesce(m.last_name,'')),
    m.member_type, m.identifier, m.photo_url,
    c.name, c.section, m.valid_until, m.status,
    s.name, s.logo_url
  from public.members m
  join public.schools s on s.id = m.school_id
  left join public.classes c on c.id = m.class_id
  where m.qr_token = token and m.status = 'active'
$$;
grant execute on function public.verify_card(uuid) to anon, authenticated;

-- ── Auto-provision a profile on signup (admin assigns school + role later) ─
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.app_users (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), 'operator')
  on conflict (id) do nothing;
  return new;
end $$;
create or replace trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

-- ── Storage buckets + policies ───────────────────────────────────────────
insert into storage.buckets (id, name, public) values
  ('photos','photos',true),
  ('logos','logos',true),
  ('cards','cards',false)
on conflict (id) do nothing;

drop policy if exists "public read assets" on storage.objects;
create policy "public read assets" on storage.objects for select using (bucket_id in ('photos','logos'));
drop policy if exists "auth read cards" on storage.objects;
create policy "auth read cards" on storage.objects for select to authenticated using (bucket_id = 'cards');
drop policy if exists "auth upload assets" on storage.objects;
create policy "auth upload assets" on storage.objects for insert to authenticated with check (bucket_id in ('photos','logos','cards'));
drop policy if exists "auth update assets" on storage.objects;
create policy "auth update assets" on storage.objects for update to authenticated using (bucket_id in ('photos','logos','cards'));
drop policy if exists "auth delete assets" on storage.objects;
create policy "auth delete assets" on storage.objects for delete to authenticated using (bucket_id in ('photos','logos','cards'));

-- ════════════════════════════════════════════════════════════════════════
-- BOOTSTRAP (run once after your first signup, replacing the email):
--   insert into public.schools (name, academic_year) values ('My School','2025-2026');
--   update public.app_users set role='super_admin',
--     school_id=(select id from public.schools limit 1)
--   where id=(select id from auth.users where email='you@example.com');
-- ════════════════════════════════════════════════════════════════════════
