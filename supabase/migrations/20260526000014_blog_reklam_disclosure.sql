-- FAZ 11 — Reklam (advertising) disclosure tracking
-- Türkiye Reklam Kurulu / TKHK Madde 61 compliance:
-- If AI-generated blog content mentions a specific business by name,
-- the post must carry a #reklam disclosure. We auto-detect business
-- mentions and flag the version so the panel can show a warning + ensure
-- the #reklam footer is present.

alter table public.blog_site_versions
  add column if not exists requires_reklam_disclosure boolean default false,
  add column if not exists business_mentions text[] default '{}';

create index if not exists idx_bsv_requires_reklam
  on public.blog_site_versions(requires_reklam_disclosure)
  where requires_reklam_disclosure = true;

comment on column public.blog_site_versions.requires_reklam_disclosure is
  'TRUE if AI generated content mentions specific business names — requires #reklam footer per Turkey advertising law.';
comment on column public.blog_site_versions.business_mentions is
  'List of detected business name phrases that triggered the disclosure requirement.';
