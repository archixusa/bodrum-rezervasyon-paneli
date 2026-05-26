-- =========================================================================
-- Row Level Security politikaları
-- =========================================================================
-- Yetki modeli:
--   anonymous  → reservation_requests'e INSERT (form endpoint)
--   authenticated (admin) → tüm tablolara tam CRUD
-- =========================================================================

alter table public.owners                enable row level security;
alter table public.properties            enable row level security;
alter table public.reservation_requests  enable row level security;
alter table public.reservations          enable row level security;
alter table public.expenses              enable row level security;
alter table public.settings              enable row level security;

-- ---- reservation_requests ----
-- Anyone can INSERT (forms)
create policy "Anyone can insert request"
  on public.reservation_requests
  for insert
  with check (true);

-- Authenticated users can read/update/delete
create policy "Admin read requests"
  on public.reservation_requests
  for select
  using (auth.role() = 'authenticated');

create policy "Admin update requests"
  on public.reservation_requests
  for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "Admin delete requests"
  on public.reservation_requests
  for delete
  using (auth.role() = 'authenticated');

-- ---- owners / properties / reservations / expenses / settings ----
-- Sadece authenticated admin (Supabase Studio'dan ilk kullanıcı davet edilir)
create policy "Admin full access on owners"
  on public.owners
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "Admin full access on properties"
  on public.properties
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "Admin full access on reservations"
  on public.reservations
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "Admin full access on expenses"
  on public.expenses
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "Admin full access on settings"
  on public.settings
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
