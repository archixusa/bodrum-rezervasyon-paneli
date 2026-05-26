export type RequestStatus = "new" | "contacted" | "converted" | "rejected" | "spam";
export type ReservationStatus = "pending" | "confirmed" | "completed" | "cancelled";
export type PropertyType = "villa" | "apart";
export type ReservationSource = "direct" | "airbnb" | "booking" | "instagram" | "referral" | "other";
export type Currency = "TRY" | "EUR" | "USD";

export interface Owner {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  iban: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Property {
  id: string;
  name: string;
  slug: string | null;
  type: PropertyType;
  location: string | null;
  district: string | null;
  owner_id: string | null;
  commission_rate: number;
  nightly_price: number | null;
  currency: Currency;
  source_site: string | null;
  capacity: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ReservationRequest {
  id: string;
  source_site: string;
  property_slug: string | null;
  property_id: string | null;
  guest_name: string;
  guest_phone: string;
  guest_email: string | null;
  check_in: string | null;
  check_out: string | null;
  guests_count: number | null;
  region: string | null;
  message: string | null;
  ip_address: string | null;
  user_agent: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  status: RequestStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Reservation {
  id: string;
  request_id: string | null;
  property_id: string;
  guest_name: string;
  guest_phone: string | null;
  guest_email: string | null;
  check_in: string;
  check_out: string;
  guests_count: number | null;
  amount: number;
  currency: Currency;
  deposit: number;
  commission_rate: number | null;
  source: ReservationSource;
  status: ReservationStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Expense {
  id: string;
  date: string;
  amount: number;
  currency: Currency;
  description: string | null;
  category: string | null;
  property_id: string | null;
  created_at: string;
}
