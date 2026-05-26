// =========================================================================
// Edge Function: notify-new-owner-application
// =========================================================================
// Fired by Postgres trigger when a new row lands in owner_applications.
// Sends Telegram + email notifications.
// =========================================================================

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const TELEGRAM_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "onboarding@resend.dev";
const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL") ?? "";
const PANEL_URL = Deno.env.get("PANEL_URL") ?? "https://admin-panel-lyart-gamma.vercel.app";

interface OwnerApplication {
  id: string;
  source_site: string;
  name: string;
  phone: string;
  email: string | null;
  region: string | null;
  property_type: string | null;
  property_count: number | null;
  currently_renting: string | null;
  current_channels: string[] | null;
  ownership_duration: string | null;
  message: string | null;
  referral_code: string | null;
  created_at: string;
}

function esc(s: string): string {
  return s.replace(/([_*[\]()~`>#+\-=|{}.!\\])/g, "\\$1");
}

function buildTelegramText(app: OwnerApplication): string {
  const lines = [
    "🏠 *YENİ MÜLK SAHİBİ BAŞVURUSU*",
    "",
    `*Site:* ${esc(app.source_site)}`,
    `*Ad:* ${esc(app.name)} \\(${esc(app.phone)}\\)`,
    app.email ? `*E\\-mail:* ${esc(app.email)}` : null,
    app.region ? `*Bölge:* ${esc(app.region)}` : null,
    app.property_type ? `*Mülk:* ${esc(app.property_type)} × ${app.property_count ?? 1}` : null,
    app.currently_renting
      ? `*Şu an kiralıyor:* ${esc(app.currently_renting)}`
      : null,
    app.current_channels && app.current_channels.length > 0
      ? `*Kanallar:* ${esc(app.current_channels.join(", "))}`
      : null,
    app.referral_code ? `*Referans:* ${esc(app.referral_code)}` : null,
    app.message ? `*Mesaj:* ${esc(app.message)}` : null,
    "",
    `[Panel'de aç](${PANEL_URL}/leads/applications)`,
  ].filter(Boolean);
  return lines.join("\n");
}

function buildEmailHtml(app: OwnerApplication): string {
  return `
  <div style="font-family:-apple-system,system-ui,sans-serif;color:#111;max-width:560px;margin:0 auto;">
    <h2 style="color:#053C4A;margin:0 0 12px;">🏠 Yeni Mülk Sahibi Başvurusu</h2>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      <tr><td style="padding:6px 0;color:#5C6B73;">Site</td><td>${app.source_site}</td></tr>
      <tr><td style="padding:6px 0;color:#5C6B73;">Ad</td><td><b>${app.name}</b></td></tr>
      <tr><td style="padding:6px 0;color:#5C6B73;">Telefon</td><td><a href="tel:${app.phone}">${app.phone}</a></td></tr>
      ${app.email ? `<tr><td style="padding:6px 0;color:#5C6B73;">E-mail</td><td><a href="mailto:${app.email}">${app.email}</a></td></tr>` : ""}
      ${app.region ? `<tr><td style="padding:6px 0;color:#5C6B73;">Bölge</td><td>${app.region}</td></tr>` : ""}
      ${app.property_type ? `<tr><td style="padding:6px 0;color:#5C6B73;">Mülk</td><td>${app.property_type} × ${app.property_count ?? 1}</td></tr>` : ""}
      ${app.currently_renting ? `<tr><td style="padding:6px 0;color:#5C6B73;">Şu an kiralıyor</td><td>${app.currently_renting}</td></tr>` : ""}
      ${app.current_channels && app.current_channels.length > 0 ? `<tr><td style="padding:6px 0;color:#5C6B73;">Kanallar</td><td>${app.current_channels.join(", ")}</td></tr>` : ""}
      ${app.ownership_duration ? `<tr><td style="padding:6px 0;color:#5C6B73;">Süre</td><td>${app.ownership_duration}</td></tr>` : ""}
      ${app.referral_code ? `<tr><td style="padding:6px 0;color:#5C6B73;">Referans</td><td>${app.referral_code}</td></tr>` : ""}
      ${app.message ? `<tr><td style="padding:6px 0;color:#5C6B73;vertical-align:top;">Mesaj</td><td style="white-space:pre-line;">${app.message}</td></tr>` : ""}
    </table>
    <div style="margin-top:24px;">
      <a href="${PANEL_URL}/leads/applications" style="display:inline-block;background:#053C4A;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;">Panel'de Aç</a>
    </div>
  </div>`;
}

async function sendTelegram(app: OwnerApplication) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
  const r = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text: buildTelegramText(app),
      parse_mode: "MarkdownV2",
      disable_web_page_preview: true,
    }),
  });
  if (!r.ok) console.error("Telegram error", r.status, await r.text());
}

async function sendEmail(app: OwnerApplication) {
  if (!RESEND_API_KEY || !ADMIN_EMAIL) return;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      reply_to: app.email ?? undefined,
      subject: `[Mülk Sahibi Başvurusu] ${app.source_site} · ${app.name}`,
      html: buildEmailHtml(app),
    }),
  });
  if (!r.ok) console.error("Resend error", r.status, await r.text());
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  let payload: { record?: OwnerApplication } | null = null;
  try {
    payload = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  const rec = payload?.record;
  if (!rec || !rec.id) return new Response("Missing record", { status: 400 });
  if (!rec.name || rec.name.length < 2) {
    return new Response(JSON.stringify({ skipped: "invalid_name" }), { status: 200 });
  }
  const [tg, em] = await Promise.allSettled([sendTelegram(rec), sendEmail(rec)]);
  return new Response(
    JSON.stringify({ id: rec.id, telegram: tg.status, email: em.status }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
