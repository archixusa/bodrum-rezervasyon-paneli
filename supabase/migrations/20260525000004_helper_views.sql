-- =========================================================================
-- Helper views (panel KPI'leri için)
-- =========================================================================

-- Yaklaşan girişler/çıkışlar
create or replace view public.upcoming_movements as
select
  r.id,
  r.property_id,
  p.name as property_name,
  r.guest_name,
  r.guest_phone,
  r.check_in,
  r.check_out,
  case
    when r.check_in between current_date and current_date + interval '7 days' then 'arrival'
    when r.check_out between current_date and current_date + interval '7 days' then 'departure'
    else null
  end as movement_type
from public.reservations r
join public.properties p on p.id = r.property_id
where r.status in ('pending','confirmed')
  and (
    r.check_in between current_date and current_date + interval '7 days'
    or r.check_out between current_date and current_date + interval '7 days'
  )
order by least(r.check_in, r.check_out);

-- Açık (bekleyen) istekler özeti
create or replace view public.requests_summary as
select
  source_site,
  status,
  count(*) as total,
  max(created_at) as last_at
from public.reservation_requests
group by source_site, status;

grant select on public.upcoming_movements to authenticated;
grant select on public.requests_summary to authenticated;
