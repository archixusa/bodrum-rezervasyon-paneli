// Newsletter confirm endpoint.
// Called from /newsletter-onayla page on each site with ?token=xxx.
// Activates the subscription if token is valid.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const body = await req.json();
    const { token } = body;
    if (!token || typeof token !== "string") throw new Error("token required");

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const { data: row, error: lookupErr } = await sb
      .from("newsletter_subscribers")
      .select("id, email, source_site, is_active, confirmed_at")
      .eq("confirmation_token", token)
      .maybeSingle();

    if (lookupErr || !row) {
      return new Response(
        JSON.stringify({ ok: false, error: "invalid_token", message: "Geçersiz veya kullanılmış doğrulama linki." }),
        { status: 404, headers: { ...CORS, "content-type": "application/json" } },
      );
    }

    if (row.is_active && row.confirmed_at) {
      return new Response(
        JSON.stringify({ ok: true, already_confirmed: true, message: "E-posta adresiniz zaten doğrulanmış." }),
        { headers: { ...CORS, "content-type": "application/json" } },
      );
    }

    await sb
      .from("newsletter_subscribers")
      .update({
        is_active: true,
        confirmed_at: new Date().toISOString(),
        confirmation_token: null,
      })
      .eq("id", row.id);

    return new Response(
      JSON.stringify({ ok: true, message: "E-posta adresiniz başarıyla doğrulandı. Listemize katıldınız." }),
      { headers: { ...CORS, "content-type": "application/json" } },
    );
  } catch (err) {
    console.error("[newsletter-confirm] error", err);
    return new Response(
      JSON.stringify({ ok: false, error: (err as Error).message }),
      { status: 400, headers: { ...CORS, "content-type": "application/json" } },
    );
  }
});
