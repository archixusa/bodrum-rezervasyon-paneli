-- Denormalize property_slug into apartment_reviews so sites can query
-- by slug without needing to know the internal property_id UUID.

alter table public.apartment_reviews
  add column if not exists property_slug text;

alter table public.review_invitations
  add column if not exists property_slug text;

create index if not exists idx_ar_property_slug
  on public.apartment_reviews(property_slug)
  where status = 'approved';

-- Backfill from existing properties table (in case data exists)
update public.apartment_reviews ar
   set property_slug = p.slug
  from public.properties p
 where ar.property_id = p.id
   and ar.property_slug is null;

update public.review_invitations ri
   set property_slug = p.slug
  from public.properties p
 where ri.property_id = p.id
   and ri.property_slug is null;

-- Update the summary view to also expose property_slug
drop view if exists public.property_review_summary;
create view public.property_review_summary as
  select
    property_id,
    coalesce(max(property_slug), '') as property_slug,
    count(*)::int as review_count,
    round(avg(rating)::numeric, 2) as average_rating,
    count(*) filter (where rating = 5)::int as count_5,
    count(*) filter (where rating = 4)::int as count_4,
    count(*) filter (where rating = 3)::int as count_3,
    count(*) filter (where rating = 2)::int as count_2,
    count(*) filter (where rating = 1)::int as count_1
  from public.apartment_reviews
  where status = 'approved'
  group by property_id;

grant select on public.property_review_summary to anon, authenticated;
