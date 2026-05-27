// Edge Function: send-review-invitation
//
// Sends a "Lütfen evimizi değerlendirin" email to a guest after their stay.
// Creates a review_invitations row with a one-time token and emails them
// a link to /yorum/<token>. Only people who get this email can submit reviews.
//
// Input:
//   { reservation_id?: string }           // auto-fill from existing reservation
// OR { property_id, guest_email, guest_name?, source_site?, language? }  // manual
//
// Triggered from:
//   - admin panel (manual button per reservation)
//   - daily cron (auto for reservations with check_out yesterday)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;

const SITE_TO_DOMAIN: Record<string, string> = {
  bodrumapartkiralama: "https://bodrumapartkiralama.com",
  bodrumapartvilla: "https://bodrumapartvilla.com",
  bodruminsaatadilat: "https://bodruminsaatadilat.com",
  bodrumacilsu: "https://bodrumacilsu.com",
};

const SITE_TO_BRAND: Record<string, string> = {
  bodrumapartkiralama: "BodrumApartKiralama.com",
  bodrumapartvilla: "BodrumApartVilla.com",
  bodruminsaatadilat: "BodrumİnşaatAdilat.com",
  bodrumacilsu: "BodrumAcilSu.com",
};

const FROM_EMAIL = Deno.env.get("REVIEW_FROM_EMAIL") ?? "rezervasyon@bodrumapartkiralama.com";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
};

function buildEmailHtml(opts: {
  guestName: string;
  propertyName: string;
  brand: string;
  reviewUrl: string;
}): { subject: string; html: string; text: string } {
  const { guestName, propertyName, brand, reviewUrl } = opts;
  const subject = `Lütfen evimizi değerlendirin — ${propertyName}`;
  const text =
    `Merhaba ${guestName},\n\n` +
    `Tatilinizin tadını çıkarmış olmanızı dileriz. ${propertyName} adresindeki konaklamanızı kısaca değerlendirirseniz, bizden sonra konaklayacak misafirlerimize çok yardımcı olursunuz.\n\n` +
    `Değerlendirmenizi şu linkten paylaşabilirsiniz (2 dakika sürer, dilerseniz anonim olarak da yazabilirsiniz):\n${reviewUrl}\n\n` +
    `Bu link size özel — başka kişiyle paylaşmayın.\n\n` +
    `Bir sonraki Bodrum tatilinizde tekrar görüşmek dileğiyle,\n${brand}`;

  const html = `<!doctype html>
<html lang="tr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f4f6f8;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="max-width:560px;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
        <tr><td style="padding:32px 32px 16px 32px;">
          <p style="margin:0 0 4px;font-size:12px;letter-spacing:.05em;color:#64748b;text-transform:uppercase;">${brand}</p>
          <h1 style="margin:0;font-size:22px;line-height:1.3;color:#0f172a;">Lütfen evimizi değerlendirin</h1>
        </td></tr>
        <tr><td style="padding:0 32px 16px 32px;font-size:15px;line-height:1.6;color:#334155;">
          <p>Merhaba <strong>${guestName}</strong>,</p>
          <p>Tatilinizin tadını çıkarmış olmanızı dileriz. <strong>${propertyName}</strong> adresindeki konaklamanızı kısaca değerlendirirseniz, bizden sonra konaklayacak misafirlerimize çok yardımcı olursunuz.</p>
          <p>Değerlendirmeniz 2 dakikanızı alır. Dilerseniz isminizle, dilerseniz <em>anonim</em> olarak paylaşabilirsiniz.</p>
        </td></tr>
        <tr><td align="center" style="padding:8px 32px 24px;">
          <a href="${reviewUrl}" style="display:inline-block;padding:14px 28px;border-radius:10px;background:#0c4a6e;color:#fff;font-weight:600;text-decoration:none;font-size:15px;">Değerlendirme yaz →</a>
        </td></tr>
        <tr><td style="padding:0 32px 24px;font-size:13px;color:#64748b;line-height:1.6;">
          <p>Bu link size özeldir — başka kişiyle paylaşmayın.</p>
          <p style="margin:16px 0 0;">Bir sonraki Bodrum tatilinizde tekrar görüşmek dileğiyle,<br/><strong>${brand}</strong></p>
        </td></tr>
      </table>
      <p style="font-size:11px;color:#94a3b8;margin:16px 0 0;">Bu e-posta, ${brand} üzerinden yaptığınız rezervasyon nedeniyle gönderilmiştir.</p>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, html, text };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const body = await req.json();
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    let property_id: string;
    let guest_email: string;
    let guest_name: string | null;
    let reservation_id: string | null = null;
    let source_site: string | null = null;
    const language: string = body.language ?? "tr";

    if (body.reservation_id) {
      // Auto-fill from existing reservation
      const { data: res, error } = await sb
        .from("reservations")
        .select("id, property_id, guest_name, guest_email, source_site")
        .eq("id", body.reservation_id)
        .single();
      if (error || !res) throw new Error("reservation not found: " + error?.message);
      if (!res.guest_email) throw new Error("reservation has no guest_email");

      property_id = res.property_id;
      guest_email = res.guest_email;
      guest_name = res.guest_name ?? "Misafirimiz";
      reservation_id = res.id;
      source_site = res.source_site;
    } else if (body.property_id && body.guest_email) {
      property_id = body.property_id;
      guest_email = body.guest_email;
      guest_name = body.guest_name ?? "Misafirimiz";
      source_site = body.source_site ?? null;
    } else {
      throw new Error("reservation_id OR (property_id + guest_email) required");
    }

    // Pull property name + slug
    const { data: prop } = await sb
      .from("properties")
      .select("name, slug")
      .eq("id", property_id)
      .single();
    const propertyName = prop?.name ?? "Bodrum'daki evimiz";
    const propertySlug = prop?.slug ?? null;

    // Generate token client-side for safety
    const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");

    // Insert invitation
    const { data: invitation, error: invErr } = await sb
      .from("review_invitations")
      .insert({
        token,
        reservation_id,
        property_id,
        property_slug: propertySlug,
        guest_email,
        guest_name,
        source_site,
        language,
      })
      .select("id, token")
      .single();
    if (invErr || !invitation) throw new Error("invitation insert: " + invErr?.message);

    // Build URL — default to bodrumapartkiralama if source_site unknown
    const siteKey = (source_site && SITE_TO_DOMAIN[source_site]) ? source_site : "bodrumapartkiralama";
    const domain = SITE_TO_DOMAIN[siteKey];
    const brand = SITE_TO_BRAND[siteKey];
    const localePath = language === "tr" ? "" : `/${language}`;
    const reviewUrl = `${domain}${localePath}/yorum/${invitation.token}`;

    // Send via Resend
    if (!RESEND_API_KEY) {
      console.warn("[send-review-invitation] RESEND_API_KEY not set — dry run");
      return new Response(
        JSON.stringify({
          ok: true,
          dry_run: true,
          invitation_id: invitation.id,
          review_url: reviewUrl,
        }),
        { headers: { ...CORS, "content-type": "application/json" } },
      );
    }

    const { subject, html, text } = buildEmailHtml({
      guestName: guest_name ?? "Misafirimiz",
      propertyName,
      brand,
      reviewUrl,
    });

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: guest_email,
        subject,
        html,
        text,
      }),
    });

    if (!resendRes.ok) {
      const errText = await resendRes.text();
      throw new Error(`Resend ${resendRes.status}: ${errText}`);
    }

    const resendJson = await resendRes.json();

    await sb
      .from("review_invitations")
      .update({ email_id: resendJson.id })
      .eq("id", invitation.id);

    return new Response(
      JSON.stringify({
        ok: true,
        invitation_id: invitation.id,
        email_id: resendJson.id,
        review_url: reviewUrl,
      }),
      { headers: { ...CORS, "content-type": "application/json" } },
    );
  } catch (err) {
    console.error("[send-review-invitation] error", err);
    return new Response(
      JSON.stringify({ ok: false, error: (err as Error).message }),
      { status: 500, headers: { ...CORS, "content-type": "application/json" } },
    );
  }
});
