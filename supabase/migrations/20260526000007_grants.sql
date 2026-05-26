-- =========================================================================
-- Explicit table grants so the new sb_publishable_* (anon) key can INSERT
-- =========================================================================

grant usage on schema public to anon, authenticated;

grant insert on public.reservation_requests to anon;
grant select, insert, update, delete on public.reservation_requests to authenticated;

grant select, insert, update, delete on public.owners       to authenticated;
grant select, insert, update, delete on public.properties   to authenticated;
grant select, insert, update, delete on public.reservations to authenticated;
grant select, insert, update, delete on public.expenses     to authenticated;
grant select, insert, update, delete on public.settings     to authenticated;

grant select on public.upcoming_movements to authenticated;
grant select on public.requests_summary   to authenticated;
