export type OwnerApplicationStatus =
  | "new"
  | "contacted"
  | "converted_to_lead"
  | "rejected"
  | "spam";

export interface OwnerApplication {
  id: string;
  source_site: "bodrumapartkiralama" | "bodrumapartvilla";
  name: string;
  phone: string;
  email: string | null;
  region: string | null;
  property_type: string | null;
  property_count: number | null;
  currently_renting: "yes" | "no" | "planning" | null;
  current_channels: string[] | null;
  ownership_duration: string | null;
  message: string | null;
  referral_code: string | null;
  ip_address: string | null;
  user_agent: string | null;
  utm_source: string | null;
  status: OwnerApplicationStatus;
  lead_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
