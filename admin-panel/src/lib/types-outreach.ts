export type OutreachTargetStatus =
  | "new"
  | "queued"
  | "contacted"
  | "replied"
  | "converted"
  | "unsubscribed"
  | "bounced"
  | "suppressed";

export interface OutreachTarget {
  id: string;
  company_name: string;
  contact_name: string | null;
  email: string;
  phone: string | null;
  website: string | null;
  category: string | null;
  region: string | null;
  notes: string | null;
  source: string;
  status: OutreachTargetStatus;
  language: string;
  custom_fields: Record<string, string> | null;
  created_at: string;
  updated_at: string;
}

export interface OutreachSequence {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  steps: { day: number; subject: string; body: string }[];
}

export interface OutreachEnrollment {
  id: string;
  target_id: string;
  sequence_id: string;
  started_at: string;
  current_step: number;
  next_send_at: string | null;
  status: "active" | "paused" | "completed" | "stopped";
}

export interface OutreachSendLog {
  id: string;
  enrollment_id: string;
  target_id: string;
  step_index: number;
  subject: string;
  body_preview: string | null;
  status: "queued" | "sent" | "bounced" | "failed" | "suppressed";
  resend_id: string | null;
  error_message: string | null;
  sent_at: string;
}
