-- ════════════════════════════════════════════════════════════════════════
-- 0003 — Separate student/staff templates, applied school-wide.
-- id_templates.member_type marks who a design is for; schools gets one
-- default template per type. Re-runnable.
-- ════════════════════════════════════════════════════════════════════════

alter table public.id_templates
  add column if not exists member_type text not null default 'student';

alter table public.schools
  add column if not exists student_template_id uuid references public.id_templates(id) on delete set null,
  add column if not exists staff_template_id uuid references public.id_templates(id) on delete set null;

create index if not exists id_templates_school_type_idx
  on public.id_templates(school_id, member_type);
