// Edge Function: notify-newsletter-subscriber
// Called by DB trigger after INSERT on newsletter_subscribers.
// Sends Telegram notification (optional).
//
// Security: requires X-Webhook-Secret header (DB trigger passes it).

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const TELEGRAM_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID") ?? "";
const INTERNAL_WEBHOOK_SECRET = Deno.env.get("INTERNAL_WEBHOOK_SECRET") ?? "";

interface NewsletterRecord {
  id: string;
  email: string;
  source_site: string;
  source_page: string | null;
  subscribed_at: string;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  if (
    INTERNAL_WEBHOOK_SECRET &&
    req.headers.get("x-webhook-secret") !== INTERNAL_WEBHOOK_SECRET
  ) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const payload = await req.json();
    const rec = payload?.record as NewsletterRecord | undefined;
    if (!rec || !rec.email) {
      return new Response("Missing record", { status: 400 });
    }

    if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
      const escape = (s: string) =>
        s.replace(/[_*[\]()~`>#+\-=|{}.!]/g, (m) => "\\" + m);
      const text =
        `📧 *Yeni newsletter abonesi*\n\n` +
        `*Email:* \`${escape(rec.email)}\`\n` +
        `*Site:* ${escape(rec.source_site)}\n` +
        `*Sayfa:* ${escape(rec.source_page ?? "—")}`;

      const tgRes = await fetch(
        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: TELEGRAM_CHAT_ID,
            text,
            parse_mode: "MarkdownV2",
          }),
        },
      );
      if (!tgRes.ok) {
        console.warn("Telegram send failed:", await tgRes.text());
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("notify-newsletter-subscriber error:", err);
    return new Response(
      JSON.stringify({ ok: false, error: (err as Error).message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
