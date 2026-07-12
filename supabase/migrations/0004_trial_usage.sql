-- Usage-based trial (game-demo style): a school gets a budget of ACTIVE login
-- time. Only the app's service-role key touches this table (RLS on, no policies),
-- so it stays private. The app constant decides WHICH schools have a trial and
-- their limit; this table just stores the consumed time.

create table if not exists public.trial_usage (
  school_id    uuid primary key references public.schools(id) on delete cascade,
  seconds_used integer not null default 0,
  started_at   timestamptz,
  last_tick    timestamptz,
  updated_at   timestamptz not null default now()
);

alter table public.trial_usage enable row level security;
-- No policies: the service-role key bypasses RLS; the browser never reads/writes this.

-- Atomic heartbeat: add the real elapsed active time since the last tick, capped
-- by p_max_gap so idle/closed gaps are not counted, using the DB clock. Creates
-- the row on first tick. Returns the new consumed seconds (capped at p_limit).
create or replace function public.trial_tick(
  p_school_id uuid,
  p_limit     integer,
  p_max_gap   integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_used integer;
  v_last timestamptz;
  v_gap  integer;
begin
  select seconds_used, last_tick into v_used, v_last
    from public.trial_usage where school_id = p_school_id for update;

  if not found then
    insert into public.trial_usage (school_id, seconds_used, started_at, last_tick)
    values (p_school_id, 0, now(), now());
    return 0;
  end if;

  if v_last is not null then
    v_gap := floor(extract(epoch from (now() - v_last)))::int;
    if v_gap > 0 and v_gap <= p_max_gap then
      v_used := least(p_limit, v_used + v_gap);
    end if;
  end if;

  update public.trial_usage
     set seconds_used = v_used,
         started_at   = coalesce(started_at, now()),
         last_tick    = now(),
         updated_at   = now()
   where school_id = p_school_id;

  return v_used;
end $$;

-- Seed Tulips Concept School Siddipet ONLY (4h budget lives in the app config).
-- Tulips Ensanpally is intentionally NOT seeded — it has no trial.
insert into public.trial_usage (school_id, seconds_used)
values ('217189b4-4c3a-4b97-8646-fa94e9eb78cc', 0)
on conflict (school_id) do nothing;
