-- RPC to set the internal webhook secret. Only callable by service_role
-- (the function is in public schema for REST access but requires the caller
-- to authenticate as service_role; anon/authenticated cannot execute).
create or replace function public.set_internal_webhook_secret(p_value text)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
begin
  insert into private.webhook_secrets (name, value)
    values ('internal', p_value)
    on conflict (name) do update set value = excluded.value, updated_at = now();
end;
$$;

revoke all on function public.set_internal_webhook_secret(text) from public, anon, authenticated;
-- service_role can call anything by default
