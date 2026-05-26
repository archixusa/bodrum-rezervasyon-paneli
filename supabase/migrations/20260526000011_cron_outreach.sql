-- =========================================================================
-- pg_cron schedule: outreach-tick every 15 minutes (business hours TR)
-- =========================================================================

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net  with schema extensions;

-- Drop any prior schedule with same name (idempotent)
do $$
begin
  if exists (select 1 from cron.job where jobname = 'outreach-tick-every-15m') then
    perform cron.unschedule('outreach-tick-every-15m');
  end if;
end$$;

-- Every 15 minutes, between 09:00 and 19:00 Europe/Istanbul (06:00-16:00 UTC).
-- pg_cron runs in UTC; we encode the hour window in cron expression.
select cron.schedule(
  'outreach-tick-every-15m',
  '*/15 6-16 * * *',
  $$
  select net.http_post(
    url := 'https://ddnigdorbnvnubjejzfu.supabase.co/functions/v1/outreach-tick',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := '{}'::jsonb
  );
  $$
);
