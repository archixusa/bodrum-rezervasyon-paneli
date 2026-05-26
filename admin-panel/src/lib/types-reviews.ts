export interface ApartmentReview {
  id: string;
  invitation_id: string;
  property_id: string;
  rating: number;
  title: string | null;
  body: string;
  display_mode: "named" | "anonymous";
  display_name: string | null;
  language: string;
  source_site: string | null;
  status: "pending" | "approved" | "rejected";
  rejection_reason: string | null;
  approved_by: string | null;
  approved_at: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReviewInvitation {
  id: string;
  token: string;
  reservation_id: string | null;
  property_id: string;
  guest_email: string;
  guest_name: string | null;
  source_site: string | null;
  language: string;
  sent_at: string;
  expires_at: string;
  used_at: string | null;
  email_id: string | null;
  created_at: string;
}
