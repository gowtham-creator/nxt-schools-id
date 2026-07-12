-- Super-admin-managed access limits: a per-school budget + on/off switch, so the
-- Platform console can assign, extend, reset, or lift a time limit for any school.
alter table public.trial_usage
  add column if not exists seconds_limit integer not null default 14400,
  add column if not exists enabled       boolean not null default true;
