-- =========================================================================
-- Database webhook -> Edge Function notify-new-request
-- =========================================================================
-- Uses pg_net (always available on Supabase) to POST every INSERT into
-- reservation_requests to the notify-new-request Edge Function.
-- =========================================================================

create extension if not exists pg_net with schema extensions;

create or replace function public.notify_new_reservation_request()
returns trigger
language plpgsql
security definer
as $$
begin
  perform net.http_post(
    url := 'https://ddnigdorbnvnubjejzfu.supabase.co/functions/v1/notify-new-request',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'reservation_requests',
      'record', to_jsonb(new)
    )
  );
  return new;
end;
$$;

drop trigger if exists reservation_requests_notify_webhook on public.reservation_requests;

create trigger reservation_requests_notify_webhook
  after insert on public.reservation_requests
  for each row
  execute function public.notify_new_reservation_request();
