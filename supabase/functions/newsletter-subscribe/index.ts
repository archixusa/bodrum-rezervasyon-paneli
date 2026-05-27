// Public newsletter subscribe endpoint with double opt-in.
// Site form POSTs here → row created with is_active=false + token →
// confirmation email sent → user clicks link → newsletter-confirm activates.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL = Deno.env.get("NEWSLETTER_FROM_EMAIL") ?? "onboarding@resend.dev";

const SITE_INFO: Record<string, { brand: string; domain: string }> = {
  bodrumapartkiralama: { brand: "BodrumApartKiralama.com", domain: "https://bodrumapartkiralama.com" },
  bodrumapartvilla: { brand: "BodrumApartVilla.com", domain: "https://bodrumapartvilla.com" },
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const body = await req.json();
    const { email, source_site, source_page } = body;

    if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("invalid_email");
    }
    if (!source_site || !SITE_INFO[source_site]) {
      throw new Error("invalid_source_site");
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const ua = req.headers.get("user-agent") ?? null;

    // Upsert by (lower(email), source_site) — handled by unique index
    const { data, error } = await sb
      .from("newsletter_subscribers")
      .upsert(
        {
          email,
          source_site,
          source_page: source_page ?? null,
          ip_address: ip,
          user_agent: ua,
          is_active: false,
          confirmation_token: token,
          subscribed_at: new Date().toISOString(),
        },
        { onConflict: "email,source_site", ignoreDuplicates: false },
      )
      .select("id, confirmation_token, is_active, confirmed_at")
      .single();

    if (error) {
      // duplicate may surface as error if unique index ignore disabled
      console.error("[newsletter-subscribe] insert err", error);
      // try update if already exists (lowercase email key) — best effort
    }

    // If already confirmed, respond friendly without sending email
    if (data?.is_active && data?.confirmed_at) {
      return new Response(
        JSON.stringify({
          ok: true,
          already_confirmed: true,
          message: "E-posta adresiniz zaten listemizde kayıtlı.",
        }),
        { headers: { ...CORS, "content-type": "application/json" } },
      );
    }

    // Send confirmation email
    const { brand, domain } = SITE_INFO[source_site];
    const confirmUrl = `${domain}/newsletter-onayla?token=${token}`;

    if (RESEND_API_KEY) {
      const subject = `E-posta adresinizi doğrulayın — ${brand}`;
      const text =
        `Merhaba,\n\nE-posta listemize katılmak için aşağıdaki linke tıklayın:\n${confirmUrl}\n\n` +
        `Bu linki siz talep etmediyseniz görmezden gelebilirsiniz.\n\n${brand}`;
      const html = `<!doctype html>
<html lang="tr"><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#f4f6f8;padding:32px 16px;color:#0f172a;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;">
<tr><td style="padding:28px 32px 8px 32px;">
<p style="margin:0 0 4px;font-size:11px;letter-spacing:.06em;color:#64748b;text-transform:uppercase;">${brand}</p>
<h1 style="margin:6px 0 0;font-size:20px;line-height:1.3;">E-posta adresinizi doğrulayın</h1>
</td></tr>
<tr><td style="padding:8px 32px 16px;font-size:15px;line-height:1.6;color:#334155;">
<p>Listemize katılma talebinizi aldık. Devam etmek için aşağıdaki butona basın:</p>
</td></tr>
<tr><td align="center" style="padding:0 32px 24px;">
<a href="${confirmUrl}" style="display:inline-block;padding:13px 28px;border-radius:10px;background:#0c4a6e;color:#fff;font-weight:600;text-decoration:none;font-size:15px;">E-postamı Doğrula</a>
</td></tr>
<tr><td style="padding:0 32px 24px;font-size:13px;color:#64748b;line-height:1.6;">
<p>Bu linki siz talep etmediyseniz görmezden gelebilirsiniz.</p>
<p style="margin-top:16px;">${brand}</p>
</td></tr></table>
</body></html>`;

      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: FROM_EMAIL, to: email, subject, html, text }),
      });
      if (!resendRes.ok) {
        const errText = await resendRes.text();
        console.warn(`[newsletter-subscribe] resend ${resendRes.status}: ${errText}`);
      } else {
        const j = await resendRes.json();
        await sb.from("newsletter_subscribers").update({ email_id: j.id }).eq("id", data?.id ?? "");
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        message: "E-posta adresinize doğrulama linki gönderdik. Lütfen kontrol edip onaylayın.",
      }),
      { headers: { ...CORS, "content-type": "application/json" } },
    );
  } catch (err) {
    console.error("[newsletter-subscribe] error", err);
    return new Response(
      JSON.stringify({ ok: false, error: (err as Error).message }),
      { status: 400, headers: { ...CORS, "content-type": "application/json" } },
    );
  }
});
