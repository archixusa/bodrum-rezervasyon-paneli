// Edge Function: generate-blog-post
//
// Generates a SINGLE site version of a blog post. Client orchestrates:
//   1. Client creates blog_posts row (status='generating')
//   2. Client invokes this fn TWICE in parallel — once per site
//   3. Each invocation gets its own 150-sec Edge Function budget,
//      avoiding the WORKER_RESOURCE_LIMIT we hit when doing both inline.
//   4. After both return, client computes Jaccard similarity and
//      updates both versions with the score.
//
// Input: { post_id: string, site: 'bodrumapartkiralama' | 'bodrumapartvilla' }
// Output: { ok, version_id, body_md, word_count, passes_quality_gate, quality_issues }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MODEL = "claude-sonnet-4-5";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

// ---------- shared prompt fragments --------------------------------------
const QUALITY_RULES = `
YAPISAL ZORUNLULUKLAR:
- KESİN 700-900 kelime arası. 900'ü ASLA AŞMA.
- ÖNCELİK: JSON'un EKSİKSİZ tamamlanması. body_md uzayacaksa KISALT.
- Eğer kelime sayısı 850'yi geçerse paragrafları kısaltarak topla.
- 4-6 H2 başlığı, H1 YAZMA (title JSON'a gidiyor)
- En az 4 görsel slot tanımla (markdown'a görsel YERLEŞTİRME, image_slots dizisinde)
- En az 2 "lokal sinyal": GERÇEK Bodrum mahalle/koy adı veya sezon/saat mikrobilgi
- En az 3 internal link önerisi
- FAQ bölümü: 3-5 soru-cevap (markdown body içinde "## Sıkça Sorulan Sorular" başlığı altında)
- Kapanış: konaklama CTA

YASAKLI KALIPLAR (HİÇ KULLANMA):
- "Bodrum'un incisi", "muhteşem güzel", "unutamayacağınız tatil", "eşsiz güzellikler"
- "Sizin için derledik", "biz sizin için..."
- "Şüphesiz ki", "kesinlikle harika", "muhakkak ki"
- "Doyumsuz manzara", "cennetten bir köşe"
- "AI olarak", "yapay zeka olarak"

LOKAL BİLGİ KURALI:
- GERÇEK OLDUĞUNDAN EMİN OLMADIĞIN yer/restoran adını UYDURMA.
- Bodrum'un gerçek mahalle/koy isimleri: Yalıkavak, Türkbükü, Gündoğan, Gümbet, Bitez, Turgutreis, Akyarlar, Ortakent, Bodrum Merkez, Kumbahçe, Bardakçı Koyu, Karaada
- Sezon/saat/fiyat bilgileri için "yaz aylarında", "öğleden sonra", "uygun fiyatlı" gibi güvenli ifadeler
`;

const OUTPUT_SCHEMA = `
ÇIKTI: KESİNLİKLE şu JSON, başka HİÇBİR metin (code fence dahi yok):

{
  "title": "60 char altı SEO başlığı",
  "slug": "tr karakter yok (ü→u, ç→c, ş→s, ğ→g, ı→i, ö→o), kebab-case, max 60 char",
  "meta_title": "max 60 char",
  "meta_description": "tam 140-160 char arası",
  "excerpt": "180-220 char",
  "body_md": "tam markdown, sadece body (H1 yok, frontmatter yok)",
  "image_slots": [
    {"position": "hero", "search_query": "İngilizce sorgu", "alt_suggestion": "Türkçe alt"},
    {"position": "after_h2_1", "search_query": "...", "alt_suggestion": "..."},
    {"position": "after_h2_2", "search_query": "...", "alt_suggestion": "..."},
    {"position": "after_h2_3", "search_query": "...", "alt_suggestion": "..."}
  ],
  "internal_link_suggestions": [
    {"anchor": "...", "target": "/apartlar?region=yalikavak"}
  ],
  "faq": [{"q": "...", "a": "..."}],
  "schema_keywords": ["..."]
}`;

const KIRALAMA_PROMPT = `Sen bodrumapartkiralama.com sitesinin SEO içerik editörüsün.
Furkan Şahin Bodrum'da apart kiralama platformu işletiyor.

HEDEF KİTLE: orta gelirli, aile bütçesini düşünen Bodrum tatilcileri.

TON:
- Sıcak, samimi, "siz" hitabı
- Kısa-orta cümleler (12-20 kelime)
- Pratik, eyleme dönük
- Çocuk/aile perspektifi
- Liste, madde, alt başlık kullan

YAPI ÖZELLİĞİ (sibling siteye benzemesin diye):
- Numaralı/maddeli liste agresif kullan
- H2'ler somut, eyleme yönelik ("X Nasıl Bulunur" gibi)
- Çocuk + aile cümleleri sık
- Kapanış CTA: "/apartlar" sayfasına yönlendir
${QUALITY_RULES}
${OUTPUT_SCHEMA}`;

const VILLA_PROMPT = `Sen bodrumapartvilla.com sitesinin SEO içerik editörüsün.
Furkan Şahin Bodrum'da butik villa kiralama platformu işletiyor.

HEDEF KİTLE: üst gelir, butik tatil planlayan misafirler.

TON:
- Şık, dingin, betimleyici ("siz" hitap, daha resmi)
- Akıcı uzun cümleler (20-28 kelime)
- Atmosfer ve duygu öne çık
- Mimari, doğa, gastronomi katmanları

YAPI ÖZELLİĞİ (sibling siteye benzemesin diye):
- Numaralı listelerden KAÇIN, paragraf akışı tercih et
- H2'ler tematik/atmosferik ("X'in Akşam Işığı" gibi)
- Aile/çocuk vurgusu DEĞİL — premium, butik, mahremiyet
- Kapanış CTA: "/villalar" sayfasına yönlendir
${QUALITY_RULES}
${OUTPUT_SCHEMA}`;

// ---------- helpers ------------------------------------------------------
function countWords(s: string): number {
  return (s.match(/\S+/g) ?? []).length;
}

function readingTimeMin(words: number): number {
  return Math.max(1, Math.round(words / 200));
}

const LOCAL_SIGNAL_REGEX = new RegExp(
  [
    "Yalıkavak", "Türkbükü", "Gündoğan", "Gümbet", "Bitez", "Turgutreis",
    "Akyarlar", "Ortakent", "Bodrum Merkez", "Kumbahçe", "Bardakçı",
    "Karaada", "Mausoleum", "Mausoleion", "Antik Tiyatro",
    "Bodrum Kalesi", "Marina",
  ].join("|"),
  "gi",
);

function detectLocalSignals(body: string) {
  const matches = body.match(LOCAL_SIGNAL_REGEX) ?? [];
  const set = [...new Set(matches.map((m) => m.toLowerCase()))];
  return { has: set.length >= 2, found: set };
}

const BANNED = [
  "bodrumun incisi", "muhteşem güzel", "unutulmaz tatil", "sizin için derledik",
  "şüphesiz ki", "kesinlikle harika", "muhakkak ki", "eşsiz güzellikler",
  "doyumsuz manzara", "cennetten bir köşe", "tarihi dokunun büyüsü",
  "unutamayacağınız", "ai olarak", "yapay zeka olarak",
];

function bannedHits(body: string): string[] {
  const lower = body.toLowerCase();
  return BANNED.filter((b) => lower.includes(b));
}

function qualityCheck(v: any) {
  const wc = countWords(v.body_md);
  const h2 = (v.body_md.match(/^## /gm) ?? []).length;
  const localSig = detectLocalSignals(v.body_md);
  const banned = bannedHits(v.body_md);
  const issues: string[] = [];

  if (wc < 650) issues.push(`word_count_low (${wc})`);
  if (wc > 1100) issues.push(`word_count_high (${wc})`);
  if (h2 < 3) issues.push(`h2_count_low (${h2})`);
  if ((v.image_slots ?? []).length < 4) issues.push("image_slots_low");
  if (!v.meta_description || v.meta_description.length < 140 || v.meta_description.length > 160)
    issues.push(`meta_description_length (${v.meta_description?.length})`);
  if ((v.faq ?? []).length < 2) issues.push("faq_low");
  if (!localSig.has) issues.push(`local_signals_low (${localSig.found.length})`);
  if (banned.length > 0) issues.push(`banned_phrases: ${banned.join("|")}`);

  return {
    passes: issues.length === 0,
    issues,
    word_count: wc,
    reading_time_min: readingTimeMin(wc),
    local_signals_found: localSig.found,
    has_local_signals: localSig.has,
  };
}

async function callClaude(systemPrompt: string, userPrompt: string) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 6000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Anthropic ${res.status}: ${t}`);
  }
  const data = await res.json();
  const text: string = data.content?.[0]?.text ?? "";
  return { text, usage: data.usage };
}

function parseAiJson(text: string): any {
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("No JSON object in AI text");
  return JSON.parse(m[0]);
}

function seasonFromMonth(m: number): string {
  if (m >= 3 && m <= 5) return "spring";
  if (m >= 6 && m <= 8) return "summer";
  if (m >= 9 && m <= 11) return "fall";
  return "winter";
}

// ---------- background worker -------------------------------------------
async function runGeneration(post_id: string, site: string) {
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  try {
    const { data: post, error: postErr } = await sb
      .from("blog_posts")
      .select("*")
      .eq("id", post_id)
      .single();
    if (postErr || !post) throw new Error("post_id not found: " + postErr?.message);

    const season = seasonFromMonth(new Date().getMonth() + 1);
    const userPrompt = `KONU: ${post.topic}
${post.topic_category ? `KATEGORİ: ${post.topic_category}` : ""}
${post.brief ? `EK BRİEF: ${post.brief}` : ""}
SEZON: ${season}

Yukarıdaki şemada blog yazısı üret.`;

    const systemPrompt = site === "bodrumapartkiralama" ? KIRALAMA_PROMPT : VILLA_PROMPT;
    const ai = await callClaude(systemPrompt, userPrompt);
    const json = parseAiJson(ai.text);

    const qc = qualityCheck(json);
    const cost =
      (ai.usage?.input_tokens ?? 0) * 0.000003 +
      (ai.usage?.output_tokens ?? 0) * 0.000015;

    const row = {
      post_id: post.id,
      site,
      title: json.title,
      slug: json.slug,
      meta_title: json.meta_title ?? json.title,
      meta_description: json.meta_description,
      excerpt: json.excerpt,
      body_md: json.body_md,
      word_count: qc.word_count,
      reading_time_min: qc.reading_time_min,
      hero_image: json.image_slots?.find((s: any) => s.position === "hero") ?? null,
      inline_images: json.image_slots ?? [],
      schema_jsonld: {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: json.title,
        description: json.meta_description,
        keywords: json.schema_keywords ?? [],
      },
      internal_links: json.internal_link_suggestions ?? [],
      faq: json.faq ?? [],
      has_local_signals: qc.has_local_signals,
      local_signals_found: qc.local_signals_found,
      passes_quality_gate: qc.passes,
      quality_issues: qc.issues,
      generation_model: MODEL,
      generation_tokens_input: ai.usage?.input_tokens ?? null,
      generation_tokens_output: ai.usage?.output_tokens ?? null,
      generation_cost_usd: cost,
      status: "review",
    };

    const { data: existing } = await sb
      .from("blog_site_versions")
      .select("id")
      .eq("post_id", post_id)
      .eq("site", site)
      .maybeSingle();

    if (existing) {
      await sb.from("blog_site_versions").update(row).eq("id", existing.id);
    } else {
      await sb.from("blog_site_versions").insert(row);
    }

    // Mark post as review (both versions or just this one — set to review either way)
    await sb.from("blog_posts").update({ status: "review" }).eq("id", post_id);
    console.log(`[generate-blog-post] done: post=${post_id} site=${site} words=${qc.word_count}`);
  } catch (err) {
    console.error(`[generate-blog-post] worker error post=${post_id} site=${site}:`, err);
    // Update post status to flag error
    try {
      await sb
        .from("blog_posts")
        .update({
          status: "idea",
          brief: `[ERR ${site}] ${(err as Error).message}`,
        })
        .eq("id", post_id);
    } catch {}
  }
}

// ---------- main handler -------------------------------------------------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const body = await req.json();
    const { post_id, site } = body;

    if (!post_id || !site) {
      throw new Error("post_id and site required");
    }
    if (site !== "bodrumapartkiralama" && site !== "bodrumapartvilla") {
      throw new Error("invalid site");
    }

    // Fire-and-forget: kick off generation in background, return 202 immediately.
    // Browser/proxy keeps choking on long (~90s) connections — this pattern
    // sidesteps the issue. Client polls via Supabase Realtime subscription
    // on blog_site_versions inserts/updates.
    // @ts-ignore — EdgeRuntime is a Supabase Edge Functions global
    EdgeRuntime.waitUntil(runGeneration(post_id, site));

    return new Response(
      JSON.stringify({ ok: true, status: "started", post_id, site }),
      { status: 202, headers: { ...CORS, "content-type": "application/json" } },
    );
  } catch (err) {
    console.error("[generate-blog-post] handler error", err);
    return new Response(
      JSON.stringify({ ok: false, error: (err as Error).message }),
      { status: 400, headers: { ...CORS, "content-type": "application/json" } },
    );
  }
});
