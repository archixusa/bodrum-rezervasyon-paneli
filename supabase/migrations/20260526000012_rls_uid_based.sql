-- =========================================================================
-- RLS policies — switch from auth.role()='authenticated' to auth.uid() IS NOT NULL
-- =========================================================================
-- The new sb_publishable_*/sb_secret_* key model resolves the JWT role
-- differently than the legacy JWT keys; auth.uid() is the stable signal that
-- "this request is a logged-in user". Easier to reason about, works for
-- both old and new key formats.
-- =========================================================================

-- reservation_requests
drop policy if exists "Anon can insert request"  on public.reservation_requests;
drop policy if exists "Admin read requests"      on public.reservation_requests;
drop policy if exists "Admin update requests"    on public.reservation_requests;
drop policy if exists "Admin delete requests"    on public.reservation_requests;

create policy "Anyone can insert request"
  on public.reservation_requests for insert
  to public
  with check (true);

create policy "Auth read requests"
  on public.reservation_requests for select
  to public
  using (auth.uid() is not null);

create policy "Auth update requests"
  on public.reservation_requests for update
  to public
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

create policy "Auth delete requests"
  on public.reservation_requests for delete
  to public
  using (auth.uid() is not null);

-- owner_applications
drop policy if exists "Anon can insert owner application" on public.owner_applications;
drop policy if exists "Admin owner_apps full"             on public.owner_applications;

create policy "Anyone can insert owner application"
  on public.owner_applications for insert
  to public
  with check (true);

create policy "Auth read owner_applications"
  on public.owner_applications for select
  to public
  using (auth.uid() is not null);

create policy "Auth modify owner_applications"
  on public.owner_applications for update
  to public
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

-- owner_leads, referral_codes, owners, properties, reservations, expenses, settings,
-- property_templates, property_site_versions, property_images,
-- outreach_*  → recreate as auth.uid() IS NOT NULL
do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'owner_leads',
      'referral_codes',
      'owners',
      'properties',
      'reservations',
      'expenses',
      'settings',
      'property_templates',
      'property_site_versions',
      'property_images',
      'outreach_targets',
      'outreach_sequences',
      'outreach_enrollments',
      'outreach_send_log',
      'outreach_suppression',
      'outreach_daily_limits'
    ])
  loop
    execute format('drop policy if exists "Admin full %I" on public.%I', t, t);
    execute format('drop policy if exists "Admin full %s" on public.%I', t, t);
    execute format('drop policy if exists "Admin full access on %s" on public.%I', t, t);
    execute format(
      'create policy "Auth full %I" on public.%I for all to public using (auth.uid() is not null) with check (auth.uid() is not null)',
      t, t
    );
  end loop;
end$$;

-- property_site_versions: keep public read for published rows (sites need it)
drop policy if exists "Public read published psv" on public.property_site_versions;
create policy "Public read published psv"
  on public.property_site_versions for select
  to anon
  using (status = 'published');

-- property_images: public read
drop policy if exists "Public read images" on public.property_images;
create policy "Public read images"
  on public.property_images for select
  to anon
  using (true);

-- outreach_suppression: anyone can insert (unsub link)
create policy "Anon insert suppression v2"
  on public.outreach_suppression for insert
  to anon
  with check (true);
