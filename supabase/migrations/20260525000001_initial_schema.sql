-- =========================================================================
-- Bodrum Rezervasyon Yönetim Sistemi — Initial Schema
-- =========================================================================
-- Notlar:
--   * Tüm para birimleri numeric(12,2). Currency satırda ayrıca tutuluyor.
--   * Saat dilimi Europe/Istanbul; uygulamada UTC depolayıp client'ta çeviriyoruz.
--   * RLS prensibi: form endpoint'i sadece reservation_requests'e INSERT,
--     diğer tüm CRUD authenticated admin gerektirir.
-- =========================================================================

-- Helpful extensions
create extension if not exists "pgcrypto";

-- =========================================================================
-- owners
-- =========================================================================
create table public.owners (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  phone         text,
  email         text,
  iban          text,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index owners_name_idx on public.owners (name);

-- =========================================================================
-- properties
-- =========================================================================
create table public.properties (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  slug            text unique,                   -- sitedeki URL slug'ı
  type            text not null check (type in ('villa','apart')),
  location        text,
  district        text,                          -- gumbet, yalikavak ...
  owner_id        uuid references public.owners(id) on delete set null,
  commission_rate numeric(5,2) not null default 15,
  nightly_price   numeric(12,2),
  currency        text not null default 'TRY' check (currency in ('TRY','EUR','USD')),
  source_site     text,                          -- hangi site listeliyor
  capacity        int,
  bedrooms        int,
  bathrooms       int,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index properties_owner_idx on public.properties (owner_id);
create index properties_slug_idx  on public.properties (slug);
create index properties_district_idx on public.properties (district);

-- =========================================================================
-- reservation_requests
-- Siteden gelen ham istekler; admin paneli buradan işleyip rezervasyona çevirir.
-- =========================================================================
create table public.reservation_requests (
  id              uuid primary key default gen_random_uuid(),
  source_site     text not null,                 -- bodrumapartkiralama, bodrumapartvilla, ...
  property_slug   text,                          -- formdan gelen (henüz id eşleşmemiş olabilir)
  property_id     uuid references public.properties(id) on delete set null,
  guest_name      text not null,
  guest_phone     text not null,
  guest_email     text,
  check_in        date,
  check_out       date,
  guests_count    int,
  region          text,
  message         text,
  ip_address      text,
  user_agent      text,
  utm_source      text,
  utm_medium      text,
  utm_campaign    text,
  status          text not null default 'new'
                    check (status in ('new','contacted','converted','rejected','spam')),
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index requests_status_idx     on public.reservation_requests (status);
create index requests_source_idx     on public.reservation_requests (source_site);
create index requests_created_idx    on public.reservation_requests (created_at desc);
create index requests_ip_idx         on public.reservation_requests (ip_address);

-- =========================================================================
-- reservations
-- Onaylanmış rezervasyonlar.
-- =========================================================================
create table public.reservations (
  id              uuid primary key default gen_random_uuid(),
  request_id      uuid references public.reservation_requests(id) on delete set null,
  property_id     uuid not null references public.properties(id) on delete restrict,
  guest_name      text not null,
  guest_phone     text,
  guest_email     text,
  check_in        date not null,
  check_out       date not null,
  guests_count    int,
  amount          numeric(12,2) not null,
  currency        text not null default 'TRY' check (currency in ('TRY','EUR','USD')),
  deposit         numeric(12,2) not null default 0,
  commission_rate numeric(5,2),                  -- snapshot; mülk değişirse korunsun
  source          text default 'direct'
                    check (source in ('direct','airbnb','booking','instagram','referral','other')),
  status          text not null default 'pending'
                    check (status in ('pending','confirmed','completed','cancelled')),
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (check_out > check_in)
);

create index reservations_property_idx on public.reservations (property_id);
create index reservations_status_idx   on public.reservations (status);
create index reservations_range_idx    on public.reservations (check_in, check_out);

-- =========================================================================
-- expenses
-- =========================================================================
create table public.expenses (
  id              uuid primary key default gen_random_uuid(),
  date            date not null,
  amount          numeric(12,2) not null,
  currency        text not null default 'TRY' check (currency in ('TRY','EUR','USD')),
  description     text,
  category        text,
  property_id     uuid references public.properties(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index expenses_date_idx     on public.expenses (date desc);
create index expenses_category_idx on public.expenses (category);

-- =========================================================================
-- settings (key/value)
-- =========================================================================
create table public.settings (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now()
);

insert into public.settings (key, value) values
  ('fx_rates', '{"EUR_TRY": 36.5, "USD_TRY": 34.0, "as_of": null}'::jsonb),
  ('notification_templates', '{
    "telegram_new_request": "🔔 *YENİ REZERVASYON İSTEĞİ*\n\nSite: {source_site}\nMisafir: {guest_name} ({guest_phone})\nTarih: {check_in} → {check_out} ({nights} gece)\nKişi: {guests_count}\nMülk: {property_slug}\nMesaj: {message}\n\nPanel: {panel_url}/requests/{id}"
  }'::jsonb),
  ('panel_url', '"http://localhost:3000"'::jsonb)
on conflict (key) do nothing;

-- =========================================================================
-- updated_at trigger
-- =========================================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger owners_set_updated_at
  before update on public.owners for each row execute function public.set_updated_at();
create trigger properties_set_updated_at
  before update on public.properties for each row execute function public.set_updated_at();
create trigger requests_set_updated_at
  before update on public.reservation_requests for each row execute function public.set_updated_at();
create trigger reservations_set_updated_at
  before update on public.reservations for each row execute function public.set_updated_at();
