-- =========================================================================
-- FAZ 7 — Multi-site property publishing (AI content generation)
-- =========================================================================

create table public.property_templates (
  id                    uuid primary key default gen_random_uuid(),
  internal_name         text not null,
  region                text not null,
  district              text,
  type                  text check (type in ('villa','apart','daire','apart_otel')),
  bedrooms              int,
  bathrooms             int,
  max_guests            int,
  size_m2               int,
  has_pool              boolean default false,
  pool_type             text,
  has_garden            boolean default false,
  distance_to_beach_m   int,
  distance_to_center_m  int,
  amenities             jsonb,
  base_price_try        numeric(12,2),
  base_price_eur        numeric(12,2),
  raw_description       text,
  highlights            text[],
  owner_id              uuid references public.owners(id) on delete set null,
  status                text default 'draft'
                          check (status in ('draft','generating','review','published','archived')),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index property_templates_status_idx on public.property_templates (status);
create index property_templates_owner_idx  on public.property_templates (owner_id);

create table public.property_site_versions (
  id                    uuid primary key default gen_random_uuid(),
  template_id           uuid not null references public.property_templates(id) on delete cascade,
  site                  text not null check (site in ('bodrumapartkiralama','bodrumapartvilla')),
  slug                  text not null,
  title                 text not null,
  meta_description      text not null,
  h1                    text not null,
  hero_subtitle         text,
  description_md        text not null,
  highlights            jsonb,
  faq                   jsonb,
  featured_images       text[],
  schema_jsonld         jsonb,
  github_commit_sha     text,
  github_file_path      text,
  published_at          timestamptz,
  published_url         text,
  generated_at          timestamptz,
  generation_model      text,
  generation_tokens     int,
  human_edited          boolean default false,
  status                text default 'draft'
                          check (status in ('draft','generating','review','approved','published','archived')),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique(template_id, site)
);

create index psv_template_idx on public.property_site_versions (template_id);
create index psv_status_idx   on public.property_site_versions (status);

create table public.property_images (
  id              uuid primary key default gen_random_uuid(),
  template_id     uuid not null references public.property_templates(id) on delete cascade,
  storage_path    text not null,
  public_url      text not null,
  alt_text        text,
  display_order   int default 0,
  is_hero         boolean default false,
  width           int,
  height          int,
  size_bytes      int,
  created_at      timestamptz not null default now()
);

create index property_images_template_idx on public.property_images (template_id, display_order);

-- updated_at triggers
create trigger pt_set_updated_at
  before update on public.property_templates for each row execute function public.set_updated_at();
create trigger psv_set_updated_at
  before update on public.property_site_versions for each row execute function public.set_updated_at();

-- RLS
alter table public.property_templates      enable row level security;
alter table public.property_site_versions  enable row level security;
alter table public.property_images         enable row level security;

create policy "Admin full pt"  on public.property_templates     for all to authenticated using (true) with check (true);
create policy "Admin full psv" on public.property_site_versions for all to authenticated using (true) with check (true);
create policy "Admin full pi"  on public.property_images        for all to authenticated using (true) with check (true);

-- Public read for published site versions (so site builds can read them server-side via anon if needed)
create policy "Public read published psv"
  on public.property_site_versions
  for select
  to anon
  using (status = 'published');

create policy "Public read images"
  on public.property_images
  for select
  to anon
  using (true);

grant select, insert, update, delete on public.property_templates     to authenticated;
grant select, insert, update, delete on public.property_site_versions to authenticated;
grant select, insert, update, delete on public.property_images        to authenticated;
grant select on public.property_site_versions to anon;
grant select on public.property_images        to anon;

-- Storage bucket for property images (public read)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('property-images', 'property-images', true, 8388608,
  array['image/jpeg','image/png','image/webp','image/avif'])
on conflict (id) do nothing;

-- Storage policies
create policy "Admin upload property images"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'property-images');
create policy "Admin update property images"
  on storage.objects for update to authenticated
  using (bucket_id = 'property-images');
create policy "Admin delete property images"
  on storage.objects for delete to authenticated
  using (bucket_id = 'property-images');
create policy "Public read property images"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'property-images');
