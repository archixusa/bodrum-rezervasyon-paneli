// Edge Function: suggest-blog-topics
// Generates fresh blog topic suggestions via Claude and inserts them
// into blog_topic_pool. Skips topics that overlap (by primary_keyword
// or topic substring) with already-used or already-pooled topics.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const MODEL = "claude-sonnet-4-20250514";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

function seasonFromMonth(m: number): string {
  // Turkey climate buckets
  if (m >= 3 && m <= 5) return "spring";
  if (m >= 6 && m <= 8) return "summer";
  if (m >= 9 && m <= 11) return "fall";
  return "winter";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const body = await req.json().catch(() => ({}));
    const count = Math.min(Math.max(Number(body.count) || 10, 3), 20);

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // Pull excluded topics
    const [{ data: usedPosts }, { data: pool }] = await Promise.all([
      sb.from("blog_posts").select("topic"),
      sb.from("blog_topic_pool").select("topic, primary_keyword"),
    ]);

    const excluded = [
      ...(usedPosts ?? []).map((r: any) => r.topic),
      ...(pool ?? []).map((r: any) => r.topic),
    ]
      .filter(Boolean)
      .slice(0, 80);

    const month = new Date().getMonth() + 1;
    const season = seasonFromMonth(month);
    const monthNameTr = [
      "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
      "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
    ][month - 1];

    const systemPrompt = `Sen Bodrum bölgesi için SEO odaklı blog konu öneri uzmanısın.

Görev: ${count} adet ÖZGÜN ve KULLANILABİLİR blog konusu öner.

ZAMAN: ${monthNameTr} ${new Date().getFullYear()} (sezon: ${season})

KRİTERLER:
1. Bodrum/bölge spesifik olsun (genel "tatil rehberi" değil)
2. Long-tail keyword potansiyeli (5-7 kelimelik aramalar)
3. Sezona uygun (girilen current month dikkate al)
4. Türk turist kitlesine hitap etsin (yabancı turist için değil)
5. Daha önce kullanılmamış olsun (excluded_topics listesi ver, hiç birine benzemesin)
6. Bodrum'un spesifik mahallelerine odaklan: Yalıkavak, Gümbet, Turgutreis, Bitez, Bodrum Merkez, Gündoğan, Türkbükü, Ortakent, Akyarlar

KAÇINMA:
- "X Hakkında Bilmeniz Gereken 10 Şey" gibi klişe formatlar
- Çok geniş konular ("Bodrum'da Tatil")
- Tekrar eden temalar (excluded listesinde olan veya benzer)
- "muhteşem", "eşsiz", "şüphesiz" gibi klişe kelimeler başlıkta

KATEGORI seçenekleri (her birinden farklı olmaya çalış):
- destination_guide: bölge rehberi (Yalıkavak Gezi Rehberi vs)
- seasonal: mevsime özel (Eylül'de Bodrum Plajları vs)
- long_tail_seo: SEO uzun-kuyruk (Bodrum Aile Konaklama Hangi Bölge vs)
- travel_tips: seyahat tüyoları (Bodrum'a İlk Gidişte Bilinmesi Gerekenler vs)
- local_food: gastronomi (Bodrum'un En İyi Balık Restoranları vs)
- activity: aktivite/spor (Bodrum Tekne Turu Rotaları vs)
- event: etkinlik (Yalıkavak Pazar Günü Ne Zaman vs)
- how_to: nasıl yapılır (Bodrum'a Arabayla Nasıl Gidilir vs)

ÇIKTI: Sadece JSON array, başka hiçbir metin yok. Şu şema:
[
  {
    "topic": "konu cümlesi (60-90 karakter)",
    "category": "destination_guide" | "seasonal" | "long_tail_seo" | "travel_tips" | "local_food" | "activity" | "event" | "how_to",
    "primary_keyword": "ana hedef kelime (2-4 kelime)",
    "related_keywords": ["3-5 ilgili kelime"],
    "seasonality": "spring" | "summer" | "fall" | "winter" | "year_round",
    "rationale": "neden bu konu iyi? 1 cümle, max 120 char"
  }
]`;

    const userPrompt = `Şu konuları HARİÇ TUT (zaten kullanıldı veya havuzda):
${excluded.length > 0 ? excluded.map((t) => `- ${t}`).join("\n") : "(hiç yok, ilk öneri)"}

${count} adet özgün konu öner, sezona (${season}, ${monthNameTr}) uygun olanları öne çıkar.`;

    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 3000,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!aiRes.ok) {
      const txt = await aiRes.text();
      throw new Error(`Anthropic API error ${aiRes.status}: ${txt}`);
    }

    const aiData = await aiRes.json();
    const text: string = aiData.content?.[0]?.text ?? "";

    // Extract JSON array (allow code-fenced or raw)
    const m = text.match(/\[[\s\S]*\]/);
    if (!m) throw new Error("No JSON array in AI response: " + text.slice(0, 500));
    let suggestions: any[];
    try {
      suggestions = JSON.parse(m[0]);
    } catch (e) {
      throw new Error("Failed to parse AI JSON: " + (e as Error).message);
    }

    if (!Array.isArray(suggestions) || suggestions.length === 0) {
      throw new Error("Empty suggestions array");
    }

    // Insert
    const rows = suggestions
      .filter((s) => s.topic && typeof s.topic === "string")
      .map((s) => ({
        topic: s.topic,
        category: s.category ?? null,
        primary_keyword: s.primary_keyword ?? null,
        related_keywords: Array.isArray(s.related_keywords) ? s.related_keywords : null,
        seasonality: s.seasonality ?? "year_round",
        rationale: s.rationale ?? null,
        source: "ai_suggested",
      }));

    const { data: inserted, error: insErr } = await sb
      .from("blog_topic_pool")
      .insert(rows)
      .select();

    if (insErr) throw new Error("Insert failed: " + insErr.message);

    return new Response(
      JSON.stringify({
        ok: true,
        inserted: inserted?.length ?? 0,
        season,
        month: monthNameTr,
        cost_estimate_usd:
          ((aiData.usage?.input_tokens ?? 0) * 0.000003) +
          ((aiData.usage?.output_tokens ?? 0) * 0.000015),
      }),
      { headers: { ...CORS, "content-type": "application/json" } },
    );
  } catch (err) {
    console.error("[suggest-blog-topics] error", err);
    return new Response(
      JSON.stringify({ ok: false, error: (err as Error).message }),
      { status: 500, headers: { ...CORS, "content-type": "application/json" } },
    );
  }
});
