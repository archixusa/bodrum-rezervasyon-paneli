-- =========================================================================
-- Security hardening: pass INTERNAL_WEBHOOK_SECRET in pg_net calls.
-- =========================================================================
-- Edge Functions notify-new-request, notify-new-owner-application and
-- outreach-tick are publicly callable (kept --no-verify-jwt because they're
-- triggered by DB / cron, not by authenticated users). To prevent abuse,
-- each function verifies the X-Webhook-Secret header against this value.
--
-- The secret is stored in two places:
--   * Supabase Edge Function secrets (INTERNAL_WEBHOOK_SECRET) — read at runtime
--   * Postgres GUC (app.internal_webhook_secret) — used by these trigger fns
--
-- Set the GUC via `alter database` once, then everything reads it back.
-- =========================================================================

-- Read the secret from a vault-style table to avoid hardcoding in migrations.
-- We store it in a private schema so RLS isn't an issue.
create schema if not exists private;

create table if not exists private.webhook_secrets (
  name text primary key,
  value text not null,
  updated_at timestamptz default now()
);

-- Revoke from everyone except service_role
revoke all on private.webhook_secrets from public, anon, authenticated;

-- ------------------------------------------------------------------------
-- Helper to read the secret (security definer to bypass private schema RLS)
create or replace function private.get_webhook_secret()
returns text
language sql
security definer
set search_path = private
as $$
  select value from private.webhook_secrets where name = 'internal' limit 1;
$$;

revoke all on function private.get_webhook_secret() from public, anon, authenticated;

-- ------------------------------------------------------------------------
-- UPDATED notify trigger functions: send X-Webhook-Secret header
-- ------------------------------------------------------------------------
create or replace function public.notify_new_reservation_request()
returns trigger
language plpgsql
security definer
as $$
declare
  v_secret text;
begin
  v_secret := private.get_webhook_secret();
  perform net.http_post(
    url := 'https://ddnigdorbnvnubjejzfu.supabase.co/functions/v1/notify-new-request',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Webhook-Secret', coalesce(v_secret, '')
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'reservation_requests',
      'record', to_jsonb(new)
    )
  );
  return new;
end;
$$;

-- (Equivalent for owner_applications if such trigger exists)
do $$
declare
  fn_exists boolean;
begin
  select exists(
    select 1 from pg_proc
    where proname = 'notify_new_owner_application'
      and pronamespace = 'public'::regnamespace
  ) into fn_exists;
  if fn_exists then
    execute $f$
      create or replace function public.notify_new_owner_application()
      returns trigger language plpgsql security definer as $body$
      declare v_secret text;
      begin
        v_secret := private.get_webhook_secret();
        perform net.http_post(
          url := 'https://ddnigdorbnvnubjejzfu.supabase.co/functions/v1/notify-new-owner-application',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'X-Webhook-Secret', coalesce(v_secret, '')
          ),
          body := jsonb_build_object(
            'type', 'INSERT',
            'table', 'owner_applications',
            'record', to_jsonb(new)
          )
        );
        return new;
      end;
      $body$;
    $f$;
  end if;
end$$;

-- ------------------------------------------------------------------------
-- UPDATED cron job: outreach-tick with secret header
-- ------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from cron.job where jobname = 'outreach-tick-every-15m') then
    perform cron.unschedule('outreach-tick-every-15m');
  end if;
end$$;

select cron.schedule(
  'outreach-tick-every-15m',
  '*/15 6-16 * * *',
  $$
  select net.http_post(
    url := 'https://ddnigdorbnvnubjejzfu.supabase.co/functions/v1/outreach-tick',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Webhook-Secret', coalesce(private.get_webhook_secret(), '')
    ),
    body := '{}'::jsonb
  );
  $$
);
