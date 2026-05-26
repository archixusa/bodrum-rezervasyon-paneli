-- =========================================================================
-- Explicit role grants for new sb_publishable_* / sb_secret_* keys
-- =========================================================================
-- The new Supabase API key model maps publishable -> anon and secret -> service_role,
-- but policies created without an explicit "to <role>" clause sometimes fall back
-- to the public group which the new anon key doesn't inherit cleanly. Recreating
-- the policies with explicit role grants makes the intent unambiguous.
-- =========================================================================

drop policy if exists "Anyone can insert request" on public.reservation_requests;
drop policy if exists "Admin read requests"      on public.reservation_requests;
drop policy if exists "Admin update requests"    on public.reservation_requests;
drop policy if exists "Admin delete requests"    on public.reservation_requests;

create policy "Anon can insert request"
  on public.reservation_requests
  for insert
  to anon, authenticated
  with check (true);

create policy "Admin read requests"
  on public.reservation_requests
  for select
  to authenticated
  using (true);

create policy "Admin update requests"
  on public.reservation_requests
  for update
  to authenticated
  using (true)
  with check (true);

create policy "Admin delete requests"
  on public.reservation_requests
  for delete
  to authenticated
  using (true);

-- ---- Re-grant the other admin tables with explicit roles too ----
drop policy if exists "Admin full access on owners"       on public.owners;
drop policy if exists "Admin full access on properties"   on public.properties;
drop policy if exists "Admin full access on reservations" on public.reservations;
drop policy if exists "Admin full access on expenses"     on public.expenses;
drop policy if exists "Admin full access on settings"     on public.settings;

create policy "Admin full access on owners"
  on public.owners       for all to authenticated using (true) with check (true);
create policy "Admin full access on properties"
  on public.properties   for all to authenticated using (true) with check (true);
create policy "Admin full access on reservations"
  on public.reservations for all to authenticated using (true) with check (true);
create policy "Admin full access on expenses"
  on public.expenses     for all to authenticated using (true) with check (true);
create policy "Admin full access on settings"
  on public.settings     for all to authenticated using (true) with check (true);
