// Server-only proxy to Supabase outreach-tick Edge Function.
// We attach the webhook secret server-side so the browser never sees it.
// The route itself requires an authenticated admin session.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  // Require an authenticated session
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const secret = process.env.INTERNAL_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "INTERNAL_WEBHOOK_SECRET not configured on server" },
      { status: 500 },
    );
  }

  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/outreach-tick`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Webhook-Secret": secret,
    },
    body: "{}",
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
