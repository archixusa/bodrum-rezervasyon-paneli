// =========================================================================
// Edge Function: notify-new-request
// =========================================================================
// Trigger:
//   Supabase Dashboard -> Database -> Webhooks
//     Table: reservation_requests
//     Events: INSERT
//     Type: HTTP request -> Supabase Edge Function
//     Function: notify-new-request
//
// Side effects:
//   * Sends a Telegram message to TELEGRAM_CHAT_ID via TELEGRAM_BOT_TOKEN
//   * Sends an email via Resend to ADMIN_EMAIL
//
// Env (set in Supabase Studio -> Edge Functions -> Secrets):
//   TELEGRAM_BOT_TOKEN
//   TELEGRAM_CHAT_ID
//   RESEND_API_KEY
//   FROM_EMAIL          (default: onboarding@resend.dev)
//   ADMIN_EMAIL
//   PANEL_URL           (default: http://localhost:3000)
// =========================================================================

// deno-lint-ignore-file no-explicit-any

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const TELEGRAM_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "onboarding@resend.dev";
const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL") ?? "";
const PANEL_URL = Deno.env.get("PANEL_URL") ?? "http://localhost:3000";

interface ReservationRequest {
  id: string;
  source_site: string;
  property_slug: string | null;
  guest_name: string;
  guest_phone: string;
  guest_email: string | null;
  check_in: string | null;
  check_out: string | null;
  guests_count: number | null;
  region: string | null;
  message: string | null;
  utm_source: string | null;
  created_at: string;
}

function nightsBetween(checkIn: string | null, checkOut: string | null): number | null {
  if (!checkIn || !checkOut) return null;
  const a = new Date(checkIn).getTime();
  const b = new Date(checkOut).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

function fmtDate(d: string | null): string {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}.${m}.${y}`;
}

function escapeMarkdown(s: string): string {
  // Telegram MarkdownV2 reserved chars
  return s.replace(/([_*[\]()~`>#+\-=|{}.!\\])/g, "\\$1");
}

function buildTelegramText(r: ReservationRequest): string {
  const nights = nightsBetween(r.check_in, r.check_out);
  const lines = [
    "🔔 *YENİ REZERVASYON İSTEĞİ*",
    "",
    `*Site:* ${escapeMarkdown(r.source_site)}`,
    `*Misafir:* ${escapeMarkdown(r.guest_name)} \\(${escapeMarkdown(r.guest_phone)}\\)`,
    r.guest_email ? `*E\\-mail:* ${escapeMarkdown(r.guest_email)}` : null,
    r.check_in && r.check_out
      ? `*Tarih:* ${escapeMarkdown(fmtDate(r.check_in))} → ${escapeMarkdown(fmtDate(r.check_out))}${
          nights ? ` \\(${nights} gece\\)` : ""
        }`
      : null,
    r.guests_count ? `*Kişi:* ${r.guests_count}` : null,
    r.property_slug ? `*Mülk:* ${escapeMarkdown(r.property_slug)}` : "*Mülk:* Belirsiz",
    r.region ? `*Bölge:* ${escapeMarkdown(r.region)}` : null,
    r.message ? `*Mesaj:* ${escapeMarkdown(r.message)}` : null,
    "",
    `[Panel'de aç](${PANEL_URL}/requests/${r.id})`,
  ].filter(Boolean);
  return lines.join("\n");
}

function buildEmailHtml(r: ReservationRequest): string {
  const nights = nightsBetween(r.check_in, r.check_out);
  return `
  <div style="font-family: -apple-system, system-ui, sans-serif; color: #111; max-width: 560px; margin: 0 auto;">
    <h2 style="color:#053C4A; margin:0 0 12px;">🔔 Yeni Rezervasyon İsteği</h2>
    <table style="width:100%; border-collapse:collapse; font-size:14px;">
      <tr><td style="padding:6px 0; color:#5C6B73;">Site</td><td style="padding:6px 0;">${r.source_site}</td></tr>
      <tr><td style="padding:6px 0; color:#5C6B73;">Misafir</td><td style="padding:6px 0;"><b>${r.guest_name}</b></td></tr>
      <tr><td style="padding:6px 0; color:#5C6B73;">Telefon</td><td style="padding:6px 0;"><a href="tel:${r.guest_phone}">${r.guest_phone}</a></td></tr>
      ${r.guest_email ? `<tr><td style="padding:6px 0; color:#5C6B73;">E-mail</td><td style="padding:6px 0;"><a href="mailto:${r.guest_email}">${r.guest_email}</a></td></tr>` : ""}
      ${r.check_in ? `<tr><td style="padding:6px 0; color:#5C6B73;">Giriş</td><td style="padding:6px 0;">${fmtDate(r.check_in)}</td></tr>` : ""}
      ${r.check_out ? `<tr><td style="padding:6px 0; color:#5C6B73;">Çıkış</td><td style="padding:6px 0;">${fmtDate(r.check_out)}${nights ? ` (${nights} gece)` : ""}</td></tr>` : ""}
      ${r.guests_count ? `<tr><td style="padding:6px 0; color:#5C6B73;">Kişi</td><td style="padding:6px 0;">${r.guests_count}</td></tr>` : ""}
      ${r.property_slug ? `<tr><td style="padding:6px 0; color:#5C6B73;">Mülk</td><td style="padding:6px 0;">${r.property_slug}</td></tr>` : ""}
      ${r.region ? `<tr><td style="padding:6px 0; color:#5C6B73;">Bölge</td><td style="padding:6px 0;">${r.region}</td></tr>` : ""}
      ${r.message ? `<tr><td style="padding:6px 0; color:#5C6B73; vertical-align:top;">Mesaj</td><td style="padding:6px 0; white-space:pre-line;">${r.message}</td></tr>` : ""}
      ${r.utm_source ? `<tr><td style="padding:6px 0; color:#5C6B73;">Kaynak</td><td style="padding:6px 0;">${r.utm_source}</td></tr>` : ""}
    </table>
    <div style="margin-top:24px;">
      <a href="${PANEL_URL}/requests/${r.id}" style="display:inline-block; background:#053C4A; color:#fff; padding:10px 20px; border-radius:8px; text-decoration:none; font-weight:600;">Panel'de Aç</a>
    </div>
    <p style="color:#5C6B73; font-size:12px; margin-top:24px;">
      Bu mail otomatik olarak Supabase Edge Function tarafından gönderilmiştir.
    </p>
  </div>`;
}

async function sendTelegram(r: ReservationRequest): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.log("[notify] Telegram env yok, atlanıyor");
    return;
  }
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text: buildTelegramText(r),
      parse_mode: "MarkdownV2",
      disable_web_page_preview: true,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error("[notify] Telegram error", res.status, text);
  }
}

async function sendEmail(r: ReservationRequest): Promise<void> {
  if (!RESEND_API_KEY || !ADMIN_EMAIL) {
    console.log("[notify] Resend env yok, atlanıyor");
    return;
  }
  const subject = `[Rezervasyon Talebi] ${r.source_site} · ${r.guest_name}`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      reply_to: r.guest_email ?? undefined,
      subject,
      html: buildEmailHtml(r),
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error("[notify] Resend error", res.status, text);
  }
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  // Security: this function is publicly callable (called by DB trigger via pg_net).
  // We require INTERNAL_WEBHOOK_SECRET header to prevent abuse / unauthenticated spam.
  const expected = Deno.env.get("INTERNAL_WEBHOOK_SECRET") ?? "";
  if (expected && req.headers.get("x-webhook-secret") !== expected) {
    return new Response("Unauthorized", { status: 401 });
  }
  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  // Supabase Database Webhook payload:
  //   { type: "INSERT", table: "reservation_requests", record: {...}, ... }
  const record: ReservationRequest | null = payload?.record ?? payload?.new ?? null;
  if (!record || !record.id) {
    return new Response("Missing record", { status: 400 });
  }

  // Spam guard: status='spam' veya boş guest_name'i bildirimden hariç tut
  if (!record.guest_name || record.guest_name.length < 2) {
    return new Response(JSON.stringify({ skipped: "invalid_name" }), { status: 200 });
  }

  const tasks = [sendTelegram(record), sendEmail(record)];
  const results = await Promise.allSettled(tasks);

  const summary = {
    id: record.id,
    telegram: results[0].status,
    email: results[1].status,
  };

  return new Response(JSON.stringify(summary), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
