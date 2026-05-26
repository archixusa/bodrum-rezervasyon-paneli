-- =========================================================================
-- FAZ 10 — owner_applications + owner_leads + referrals
-- =========================================================================

create table public.owner_leads (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  phone           text,
  email           text,
  region          text,
  property_type   text,
  property_count  int default 1,
  source          text default 'inbound'
                    check (source in ('inbound','referral','outreach','manual','google_maps','airbnb')),
  status          text default 'new'
                    check (status in ('new','contacted','negotiating','converted','rejected','lost')),
  referrer_owner_id uuid references public.owners(id) on delete set null,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index owner_leads_status_idx on public.owner_leads (status);
create index owner_leads_source_idx on public.owner_leads (source);

create table public.owner_applications (
  id                  uuid primary key default gen_random_uuid(),
  source_site         text not null
                        check (source_site in ('bodrumapartkiralama','bodrumapartvilla')),
  name                text not null,
  phone               text not null,
  email               text,
  region              text,
  property_type       text,
  property_count      int default 1,
  currently_renting   text check (currently_renting in ('yes','no','planning')),
  current_channels    text[],
  ownership_duration  text,
  message             text,
  referral_code       text,
  ip_address          text,
  user_agent          text,
  utm_source          text,
  utm_medium          text,
  utm_campaign        text,
  status              text default 'new'
                        check (status in ('new','contacted','converted_to_lead','rejected','spam')),
  lead_id             uuid references public.owner_leads(id) on delete set null,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index owner_apps_status_idx on public.owner_applications (status);
create index owner_apps_source_idx on public.owner_applications (source_site);
create index owner_apps_created_idx on public.owner_applications (created_at desc);

-- Referral codes (one per owner, unique short code)
create table public.referral_codes (
  code            text primary key,
  owner_id        uuid references public.owners(id) on delete cascade,
  uses            int not null default 0,
  conversions     int not null default 0,
  reward_amount   numeric(12,2) not null default 0,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);

create index referral_codes_owner_idx on public.referral_codes (owner_id);

-- updated_at triggers
create trigger owner_leads_set_updated_at
  before update on public.owner_leads for each row execute function public.set_updated_at();
create trigger owner_apps_set_updated_at
  before update on public.owner_applications for each row execute function public.set_updated_at();

-- RLS
alter table public.owner_leads          enable row level security;
alter table public.owner_applications   enable row level security;
alter table public.referral_codes       enable row level security;

create policy "Anon can insert owner application"
  on public.owner_applications for insert to anon, authenticated with check (true);

create policy "Admin owner_apps full"
  on public.owner_applications for all to authenticated using (true) with check (true);
create policy "Admin owner_leads full"
  on public.owner_leads for all to authenticated using (true) with check (true);
create policy "Admin referral_codes full"
  on public.referral_codes for all to authenticated using (true) with check (true);

-- Grants
grant insert on public.owner_applications to anon;
grant select, insert, update, delete on public.owner_applications to authenticated;
grant select, insert, update, delete on public.owner_leads        to authenticated;
grant select, insert, update, delete on public.referral_codes     to authenticated;

-- Realtime
alter publication supabase_realtime add table public.owner_applications;
alter publication supabase_realtime add table public.owner_leads;

-- Webhook: notify on new application
create or replace function public.notify_new_owner_application()
returns trigger
language plpgsql
security definer
as $$
begin
  perform net.http_post(
    url := 'https://ddnigdorbnvnubjejzfu.supabase.co/functions/v1/notify-new-owner-application',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'owner_applications',
      'record', to_jsonb(new)
    )
  );
  return new;
end;
$$;

drop trigger if exists owner_applications_notify_webhook on public.owner_applications;
create trigger owner_applications_notify_webhook
  after insert on public.owner_applications
  for each row execute function public.notify_new_owner_application();
