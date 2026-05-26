-- =========================================================================
-- FAZ 11 — Otomatik Blog Yazma Sistemi
-- =========================================================================
-- Tables:
--   blog_posts            — konu/draft master
--   blog_site_versions    — her site için ayrı versiyon
--   blog_topic_pool       — konu havuzu (AI suggestion + manual)
--   image_search_cache    — Pexels/Unsplash cache
--   publishing_schedule   — yayın takvimi
-- =========================================================================

-- ---------- blog_posts ---------------------------------------------------
create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),

  -- Konu yönetimi
  topic text not null,
  topic_category text check (topic_category in (
    'destination_guide','seasonal','long_tail_seo','travel_tips',
    'local_food','activity','event','how_to'
  )),
  primary_keyword text,
  related_keywords text[],
  target_region text,
  target_season text check (target_season in ('spring','summer','fall','winter','year_round')),

  -- Brief (AI input)
  brief text,
  local_signals jsonb default '[]'::jsonb,

  status text default 'idea' check (status in (
    'idea','generating','review','approved','published','archived'
  )),
  scheduled_for date,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_blog_posts_status     on public.blog_posts(status);
create index if not exists idx_blog_posts_scheduled  on public.blog_posts(scheduled_for) where scheduled_for is not null;
create index if not exists idx_blog_posts_created    on public.blog_posts(created_at desc);

drop trigger if exists trg_blog_posts_updated_at on public.blog_posts;
create trigger trg_blog_posts_updated_at
  before update on public.blog_posts
  for each row execute procedure public.set_updated_at();

-- ---------- blog_site_versions -------------------------------------------
create table if not exists public.blog_site_versions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.blog_posts(id) on delete cascade,
  site text not null check (site in ('bodrumapartkiralama','bodrumapartvilla')),

  -- İçerik
  title text not null,
  slug text not null,
  meta_title text,
  meta_description text,
  excerpt text,

  body_md text not null,
  word_count int,
  reading_time_min int,

  -- Görseller
  hero_image jsonb,
  inline_images jsonb default '[]'::jsonb,

  -- SEO
  schema_jsonld jsonb,
  internal_links jsonb default '[]'::jsonb,
  faq jsonb default '[]'::jsonb,

  -- Quality metrics
  similarity_to_sibling numeric,
  has_local_signals boolean default false,
  local_signals_found text[],
  passes_quality_gate boolean default false,
  quality_issues jsonb default '[]'::jsonb,

  -- Yayın metadata
  github_commit_sha text,
  github_file_path text,
  github_pr_url text,
  published_url text,
  published_at timestamptz,

  -- AI metadata
  generated_at timestamptz default now(),
  generation_model text,
  generation_tokens_input int,
  generation_tokens_output int,
  generation_cost_usd numeric,
  human_edited boolean default false,

  status text default 'draft' check (status in (
    'draft','review','approved','published','archived'
  )),

  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  unique(post_id, site)
);

create index if not exists idx_bsv_post   on public.blog_site_versions(post_id);
create index if not exists idx_bsv_site   on public.blog_site_versions(site);
create index if not exists idx_bsv_status on public.blog_site_versions(status);
create index if not exists idx_bsv_slug   on public.blog_site_versions(site, slug);

drop trigger if exists trg_bsv_updated_at on public.blog_site_versions;
create trigger trg_bsv_updated_at
  before update on public.blog_site_versions
  for each row execute procedure public.set_updated_at();

-- ---------- blog_topic_pool ---------------------------------------------
create table if not exists public.blog_topic_pool (
  id uuid primary key default gen_random_uuid(),
  topic text not null,
  category text check (category in (
    'destination_guide','seasonal','long_tail_seo','travel_tips',
    'local_food','activity','event','how_to'
  )),
  primary_keyword text,
  related_keywords text[],
  estimated_search_volume int,
  difficulty int check (difficulty between 1 and 10),
  seasonality text check (seasonality in ('spring','summer','fall','winter','year_round')),
  rationale text,
  notes text,

  used boolean default false,
  used_in_post_id uuid references public.blog_posts(id) on delete set null,
  used_at timestamptz,

  source text default 'ai_suggested' check (source in ('ai_suggested','manual','gsc_query')),
  created_at timestamptz default now()
);

create index if not exists idx_btp_used    on public.blog_topic_pool(used);
create index if not exists idx_btp_season  on public.blog_topic_pool(seasonality);

-- ---------- image_search_cache ------------------------------------------
create table if not exists public.image_search_cache (
  id uuid primary key default gen_random_uuid(),
  query text not null,
  provider text not null check (provider in ('unsplash','pexels')),
  results jsonb not null,
  cached_at timestamptz default now(),
  unique(query, provider)
);

create index if not exists idx_isc_cached_at on public.image_search_cache(cached_at desc);

-- ---------- publishing_schedule -----------------------------------------
create table if not exists public.publishing_schedule (
  id uuid primary key default gen_random_uuid(),
  scheduled_date date not null,
  post_id uuid references public.blog_posts(id) on delete cascade,
  site text check (site in ('bodrumapartkiralama','bodrumapartvilla','both')),
  status text default 'scheduled' check (status in ('scheduled','published','skipped','failed')),
  notes text,
  created_at timestamptz default now()
);

create index if not exists idx_ps_date   on public.publishing_schedule(scheduled_date);
create index if not exists idx_ps_status on public.publishing_schedule(status);

-- ---------- RLS ----------------------------------------------------------
alter table public.blog_posts            enable row level security;
alter table public.blog_site_versions    enable row level security;
alter table public.blog_topic_pool       enable row level security;
alter table public.image_search_cache    enable row level security;
alter table public.publishing_schedule   enable row level security;

-- Admin (auth.uid() pattern — matches 20260526000012 convention)
do $$
declare t text;
begin
  for t in
    select unnest(array[
      'blog_posts','blog_site_versions','blog_topic_pool',
      'image_search_cache','publishing_schedule'
    ])
  loop
    execute format(
      'create policy "Auth full %I" on public.%I for all to public using (auth.uid() is not null) with check (auth.uid() is not null)',
      t, t
    );
  end loop;
end$$;

-- Public read for published versions (sites pull at build time, optional)
create policy "Public read published blog_site_versions"
  on public.blog_site_versions for select
  to anon
  using (status = 'published');

-- ---------- Realtime ----------------------------------------------------
alter publication supabase_realtime add table public.blog_posts;
alter publication supabase_realtime add table public.blog_site_versions;
alter publication supabase_realtime add table public.blog_topic_pool;
