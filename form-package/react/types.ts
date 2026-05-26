export type SiteName =
  | "bodrumapartkiralama"
  | "bodrumapartvilla"
  | "bodrumacilsu"
  | "bodruminsaatadilat";

export interface ReservationRequestPayload {
  source_site: SiteName;
  property_slug: string | null;
  guest_name: string;
  guest_phone: string;
  guest_email: string | null;
  check_in: string; // YYYY-MM-DD
  check_out: string;
  guests_count: number;
  region: string | null;
  message: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  user_agent?: string;
}
