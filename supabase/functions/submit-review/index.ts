// Edge Function: submit-review
//
// PUBLIC endpoint — called from /yorum/[token] form on sites.
// Validates token, checks invitation not expired & not already used,
// inserts review with status='pending' (admin must approve before display).
//
// Input: { token, rating (1-5), title?, body, display_mode: "named"|"anonymous", display_name? }
// Output: { ok, review_id, message }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
};

// Very rough spam heuristics — block obvious spam without being too aggressive
const SPAM_PATTERNS = [
  /\bviagra\b/i,
  /\bcialis\b/i,
  /\bbtc\b.*\b(wallet|sent|received)\b/i,
  /https?:\/\/(?!(?:www\.)?bodrum)[^\s]{4,}/i, // external URLs
  /\b(buy|sell)\s+(?:cheap|discount)\b/i,
];

function isSpam(text: string): boolean {
  return SPAM_PATTERNS.some((re) => re.test(text));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const body = await req.json();
    const {
      token,
      rating,
      title,
      body: reviewBody,
      display_mode,
      display_name,
    } = body;

    // Validation
    if (!token || typeof token !== "string") {
      throw new Error("token required");
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new Error("rating must be integer 1-5");
    }
    if (!reviewBody || typeof reviewBody !== "string" || reviewBody.length < 10) {
      throw new Error("body must be at least 10 characters");
    }
    if (reviewBody.length > 2000) {
      throw new Error("body too long (max 2000 chars)");
    }
    if (!["named", "anonymous"].includes(display_mode)) {
      throw new Error("display_mode must be 'named' or 'anonymous'");
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // Validate token
    const { data: inv, error: invErr } = await sb
      .from("review_invitations")
      .select("id, property_id, property_slug, guest_name, guest_email, source_site, language, used_at, expires_at")
      .eq("token", token)
      .maybeSingle();

    if (invErr) throw new Error("invitation lookup: " + invErr.message);
    if (!inv) {
      return new Response(
        JSON.stringify({ ok: false, error: "invalid_token", message: "Link geçersiz veya süresi dolmuş." }),
        { status: 404, headers: { ...CORS, "content-type": "application/json" } },
      );
    }
    if (inv.used_at) {
      return new Response(
        JSON.stringify({ ok: false, error: "already_used", message: "Bu değerlendirme linki daha önce kullanılmış." }),
        { status: 409, headers: { ...CORS, "content-type": "application/json" } },
      );
    }
    if (inv.expires_at && new Date(inv.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ ok: false, error: "expired", message: "Bu değerlendirme linkinin süresi dolmuş." }),
        { status: 410, headers: { ...CORS, "content-type": "application/json" } },
      );
    }

    // Determine display name
    let finalDisplayName: string | null = null;
    if (display_mode === "named") {
      finalDisplayName = (display_name && display_name.trim()) || inv.guest_name || "Misafir";
      // Cap length
      finalDisplayName = finalDisplayName.slice(0, 80);
    } else {
      finalDisplayName = null; // displayed as "Anonim Misafir" on frontend
    }

    // Spam check
    const flaggedSpam = isSpam(reviewBody) || (title && isSpam(title));

    // Get IP/UA from request
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("cf-connecting-ip") ??
      null;
    const ua = req.headers.get("user-agent") ?? null;

    // Insert review
    const { data: review, error: rErr } = await sb
      .from("apartment_reviews")
      .insert({
        invitation_id: inv.id,
        property_id: inv.property_id,
        property_slug: inv.property_slug,
        rating,
        title: title?.slice(0, 200) ?? null,
        body: reviewBody.trim(),
        display_mode,
        display_name: finalDisplayName,
        language: inv.language ?? "tr",
        source_site: inv.source_site,
        status: flaggedSpam ? "rejected" : "pending",
        rejection_reason: flaggedSpam ? "spam_pattern" : null,
        ip_address: ip,
        user_agent: ua,
      })
      .select("id")
      .single();

    if (rErr) {
      // unique violation = invitation already used
      if (rErr.code === "23505") {
        return new Response(
          JSON.stringify({ ok: false, error: "already_submitted", message: "Bu link için zaten bir değerlendirme gönderilmiş." }),
          { status: 409, headers: { ...CORS, "content-type": "application/json" } },
        );
      }
      throw new Error("review insert: " + rErr.message);
    }

    // Mark invitation as used
    await sb
      .from("review_invitations")
      .update({ used_at: new Date().toISOString() })
      .eq("id", inv.id);

    return new Response(
      JSON.stringify({
        ok: true,
        review_id: review!.id,
        status: flaggedSpam ? "rejected" : "pending",
        message: flaggedSpam
          ? "Değerlendirmeniz alındı; spam filtremiz tarafından işaretlendi, manuel inceleme yapılacak."
          : "Teşekkürler! Değerlendirmeniz alındı. Onaylandıktan sonra siteye yansıyacaktır (genelde 24 saat içinde).",
      }),
      { headers: { ...CORS, "content-type": "application/json" } },
    );
  } catch (err) {
    console.error("[submit-review] error", err);
    return new Response(
      JSON.stringify({ ok: false, error: (err as Error).message }),
      { status: 400, headers: { ...CORS, "content-type": "application/json" } },
    );
  }
});
