-- =========================================================================
-- Realtime publication
-- =========================================================================
-- Admin panel canlı dinleme yapsın diye reservation_requests ve reservations
-- supabase_realtime publication'ına eklenir.
-- =========================================================================

alter publication supabase_realtime add table public.reservation_requests;
alter publication supabase_realtime add table public.reservations;
