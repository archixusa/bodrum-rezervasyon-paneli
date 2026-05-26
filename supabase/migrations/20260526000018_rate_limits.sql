-- =========================================================================
-- Rate limiting on public INSERT endpoints
-- =========================================================================
-- Tables that accept anonymous INSERT (forms on public sites):
--   * reservation_requests
--   * owner_applications
--   * outreach_suppression  (unsub link)
--
-- Without rate limits, a script could spam thousands of fake submissions
-- in seconds, polluting our pipeline and burning notification budget.
--
-- Strategy: a separate tracking table keyed by IP, with a trigger that
-- blocks the INSERT if the same IP has already done >5 in the last minute
-- or >20 in the last hour.
-- =========================================================================

create table if not exists public.anon_insert_rate (
  ip_address text not null,
  table_name text not null,
  inserted_at timestamptz not null default now(),
  primary key (ip_address, table_name, inserted_at)
);

create index if not exists idx_anon_rate_ip_time
  on public.anon_insert_rate(ip_address, table_name, inserted_at desc);

-- Allow anon writes (the trigger uses security definer to write)
alter table public.anon_insert_rate enable row level security;
-- No policy = no anon access; trigger writes via security definer.

-- ------------------------------------------------------------------------
-- Helper: check + record an anon insert. Returns true if allowed, false if blocked.
-- ------------------------------------------------------------------------
create or replace function public.check_anon_rate(
  p_table text,
  p_ip text
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count_minute int;
  v_count_hour int;
  v_now timestamptz := now();
begin
  if p_ip is null or p_ip = '' then
    return true; -- can't rate limit without IP
  end if;

  -- count recent inserts from same IP
  select count(*)
    into v_count_minute
    from public.anon_insert_rate
   where ip_address = p_ip
     and table_name = p_table
     and inserted_at > v_now - interval '1 minute';

  if v_count_minute >= 5 then
    return false;
  end if;

  select count(*)
    into v_count_hour
    from public.anon_insert_rate
   where ip_address = p_ip
     and table_name = p_table
     and inserted_at > v_now - interval '1 hour';

  if v_count_hour >= 20 then
    return false;
  end if;

  -- record this attempt
  insert into public.anon_insert_rate (ip_address, table_name, inserted_at)
    values (p_ip, p_table, v_now)
    on conflict do nothing;

  return true;
end;
$$;

revoke all on function public.check_anon_rate(text, text) from public;
grant execute on function public.check_anon_rate(text, text) to anon, authenticated;

-- ------------------------------------------------------------------------
-- Triggers on each public-insert table
-- ------------------------------------------------------------------------
create or replace function public.enforce_anon_rate_limit()
returns trigger
language plpgsql
security definer
as $$
declare
  v_ip text;
  v_allowed boolean;
begin
  -- Skip rate limit for authenticated users (logged-in admins)
  if auth.uid() is not null then
    return new;
  end if;

  -- Extract IP from inserted row (each table has its own column name)
  v_ip := case TG_TABLE_NAME
    when 'reservation_requests' then new.ip_address
    when 'owner_applications'   then new.ip_address
    when 'outreach_suppression' then new.ip_address
    else null
  end;

  v_allowed := public.check_anon_rate(TG_TABLE_NAME, v_ip);
  if not v_allowed then
    raise exception 'rate_limit_exceeded'
      using errcode = '54000',
            hint = 'Too many submissions from this IP. Please try again later.';
  end if;
  return new;
end;
$$;

-- ------------------------------------------------------------------------
-- Attach to all public-insert tables
-- ------------------------------------------------------------------------
drop trigger if exists trg_anon_rate_reservation_requests on public.reservation_requests;
create trigger trg_anon_rate_reservation_requests
  before insert on public.reservation_requests
  for each row execute procedure public.enforce_anon_rate_limit();

-- owner_applications may not have ip_address — check before attaching
do $$
declare
  has_col boolean;
begin
  select exists(
    select 1 from information_schema.columns
    where table_schema='public'
      and table_name='owner_applications'
      and column_name='ip_address'
  ) into has_col;
  if has_col then
    execute 'drop trigger if exists trg_anon_rate_owner_applications on public.owner_applications';
    execute 'create trigger trg_anon_rate_owner_applications
             before insert on public.owner_applications
             for each row execute procedure public.enforce_anon_rate_limit()';
  end if;
end$$;

-- outreach_suppression — same conditional check
do $$
declare
  has_col boolean;
begin
  select exists(
    select 1 from information_schema.columns
    where table_schema='public'
      and table_name='outreach_suppression'
      and column_name='ip_address'
  ) into has_col;
  if has_col then
    execute 'drop trigger if exists trg_anon_rate_outreach_supp on public.outreach_suppression';
    execute 'create trigger trg_anon_rate_outreach_supp
             before insert on public.outreach_suppression
             for each row execute procedure public.enforce_anon_rate_limit()';
  end if;
end$$;

-- ------------------------------------------------------------------------
-- Cleanup: purge rate-limit rows older than 1 day (cron daily)
-- ------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from cron.job where jobname = 'cleanup-anon-rate-daily') then
    perform cron.unschedule('cleanup-anon-rate-daily');
  end if;
end$$;

select cron.schedule(
  'cleanup-anon-rate-daily',
  '17 3 * * *',
  $$ delete from public.anon_insert_rate where inserted_at < now() - interval '1 day'; $$
);
