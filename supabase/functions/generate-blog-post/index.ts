// Edge Function: generate-blog-post
// Text-only generation (no images yet — Pexels integration phase 2).
//
// Input: { topic_id?: string, topic_text?: string, category?: string, brief?: string }
//
// Flow:
//   1. Load/create blog_posts row (status='generating')
//   2. Call Claude twice in parallel (one per site) with distinct personas
//   3. Compute Jaccard similarity between the two body_md outputs
//   4. Insert blog_site_versions rows (status='review')
//   5. Mark blog_posts.status='review'

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

// ---------- shared prompt fragments --------------------------------------
const QUALITY_RULES = `
YAPISAL ZORUNLULUKLAR:
- 900-1300 kelime arası
- 1 H1 (title — markdown gövdesinde DEĞİL, JSON field'da), 4-6 H2, alt başlıklar H3
- En az 4 görsel slot (hero + 3 inline) — markdown'a görsel YERLEŞTİRME, sadece image_slots dizisinde tanımla
- Her H2 altında en az 2 paragraf
- En az 2 "lokal sinyal": belirli sokak/mekan adı (sadece GERÇEK olduğunu bildiğin) veya pratik mikrobilgi (sezon/saat/fiyat aralığı)
- En az 3 internal link önerisi (kendi sitendeki apart/villa/diğer blog sayfalarına)
- FAQ bölümü EKLE: 3-5 soru-cevap
- Kapanış: konaklama CTA (apartlar veya villalar sayfasına yönlendir)

YASAKLI KALIPLAR (HİÇ KULLANMA):
- "Bodrum'un incisi", "muhteşem güzel", "unutamayacağınız tatil", "eşsiz güzellikler"
- "Sizin için derledik", "biz sizin için..."
- "Şüphesiz ki", "kesinlikle harika", "muhakkak ki"
- "Doyumsuz manzara", "cennetten bir köşe", "tarihi dokunun büyüsü"
- "AI olarak", "model olarak", "yapay zeka olarak"
- 4+ ardışık sıfat zinciri ("muhteşem güzel harika eşsiz")

LOKAL BİLGİ KURALI:
- GERÇEK OLDUĞUNDAN EMİN OLMADIĞIN yer/restoran/işletme adını UYDURMA.
- "Yalıkavak'ta deniz manzaralı restoranlar" gibi GENEL ifade kullan, hayali "Limon Restoran" UYDURMA.
- Bodrum'un GERÇEK ve YAYGINCA BİLİNEN mahalle/koy isimleri kullan: Yalıkavak, Türkbükü, Gündoğan, Gümbet, Bitez, Turgutreis, Akyarlar, Ortakent, Bodrum Merkez, Kumbahçe, Bardakçı Koyu, Karaada, Kara Ada
- Sezon/saat/fiyat aralığı bilgileri kullan ama kesin tarih ya da fiyat söyleme; "yaz aylarında", "öğleden sonra", "uygun fiyatlı" gibi GÜVENLİ ifadeler kullan
`;

const OUTPUT_SCHEMA = `
ÇIKTI: KESİNLİKLE şu JSON şemasında, başka HİÇBİR metin ekleme (ne öncesinde ne sonrasında, ne markdown code fence):

{
  "title": "60 karakter altı SEO başlığı",
  "slug": "tr karakter yok (ü→u, ç→c, ş→s, ğ→g, ı→i, ö→o), kebab-case, kısa, keyword içerikli, max 60 char",
  "meta_title": "Google'da gösterilecek başlık (max 60 char)",
  "meta_description": "tam 140-160 karakter, keyword içerikli, eyleme yönlendiren",
  "excerpt": "Liste sayfası önizleme (180-220 karakter)",
  "body_md": "tam markdown içerik, H2/H3 dahil. H1 YAZMA, frontmatter YAZMA. Sadece body içeriği. FAQ kısmı bunun içinde '## Sıkça Sorulan Sorular' başlığıyla olsun.",
  "image_slots": [
    {"position": "hero", "search_query": "İngilizce arama sorgusu (bodrum yalikavak beach gibi)", "alt_suggestion": "Türkçe SEO-friendly alt text"},
    {"position": "after_h2_1", "search_query": "...", "alt_suggestion": "..."},
    {"position": "after_h2_2", "search_query": "...", "alt_suggestion": "..."},
    {"position": "after_h2_3", "search_query": "...", "alt_suggestion": "..."}
  ],
  "internal_link_suggestions": [
    {"anchor": "Yalıkavak'taki apartlarımız", "target": "/apartlar?region=yalikavak"},
    {"anchor": "Yaz tatili planlama rehberi", "target": "/blog/yaz-tatili-rehberi"}
  ],
  "faq": [
    {"q": "Soru?", "a": "Cevap."},
    ...
  ],
  "schema_keywords": ["bodrum", "yalıkavak", "..."]
}`;

const KIRALAMA_PROMPT = `Sen bodrumapartkiralama.com sitesinin SEO içerik editörüsün.
Site sahibi Furkan Şahin, Bodrum'da apart kiralama platformu işletiyor.

HEDEF KİTLE: orta gelirli, aile bütçesini düşünen, pratik bilgi arayan Bodrum tatilcileri.

TON:
- Sıcak, samimi, "siz" hitabı
- Cümleler kısa-orta (12-20 kelime ortalama)
- Pratik, eyleme dönük
- Çocuk/aile perspektifi öne çık
- Liste, madde, alt başlık kullan
- Net, gereksiz süslemesiz

YAPI ÖZELLİĞİ (siteler arası farkı yaratmak için):
- Numaralı/maddeli listelere agresif kullan ("X için 5 ipucu" tarzı)
- H2 başlıkları somut, eyleme yönelik ("Yalıkavak'ta Otopark Nasıl Bulunur" gibi)
- Çocuk + aile cümleleri sık geçsin
- Kapanış CTA: "/apartlar" sayfasına yönlendir
${QUALITY_RULES}
${OUTPUT_SCHEMA}`;

const VILLA_PROMPT = `Sen bodrumapartvilla.com sitesinin SEO içerik editörüsün.
Site sahibi Furkan Şahin, Bodrum'da butik villa kiralama platformu işletiyor.

HEDEF KİTLE: üst gelir, kaliteli deneyim arayan, butik tatil planlayan misafirler.

TON:
- Şık, dingin, betimleyici ("siz" hitap, daha resmi)
- Akıcı, uzun cümleler (20-28 kelime ortalama)
- Atmosfer ve duygu öne çık
- Mimari, doğa, sanat, gastronomi katmanları
- Sayılarla değil, deneyimle anlat

YAPI ÖZELLİĞİ (siteler arası farkı yaratmak için):
- Numaralı listelerden KAÇIN. Paragraf-akışı tercih et
- H2 başlıkları tematik/atmosferik ("Yalıkavak'ın Akşam Işığı" tarzı)
- Aile/çocuk vurgusu DEĞİL — premium misafir, butik deneyim, mahremiyet
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

// Jaccard similarity on word bigrams — robust enough for duplicate detection
function jaccardBigram(a: string, b: string): number {
  const toBigrams = (s: string) => {
    const tokens = s
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter(Boolean);
    const set = new Set<string>();
    for (let i = 0; i < tokens.length - 1; i++) {
      set.add(tokens[i] + " " + tokens[i + 1]);
    }
    return set;
  };
  const A = toBigrams(a);
  const B = toBigrams(b);
  if (A.size === 0 && B.size === 0) return 0;
  let intersect = 0;
  for (const x of A) if (B.has(x)) intersect++;
  const union = A.size + B.size - intersect;
  return union === 0 ? 0 : intersect / union;
}

const LOCAL_SIGNAL_REGEX = new RegExp(
  [
    "Yalıkavak", "Türkbükü", "Gündoğan", "Gümbet", "Bitez", "Turgutreis",
    "Akyarlar", "Ortakent", "Bodrum Merkez", "Kumbahçe", "Bardakçı",
    "Karaada", "Kara Ada", "Mausoleum", "Mausoleion", "Antik Tiyatro",
    "Bodrum Kalesi", "Marina", "Yalıkavak Marina",
  ].join("|"),
  "gi",
);

function detectLocalSignals(body: string): { has: boolean; found: string[] } {
  const matches = body.match(LOCAL_SIGNAL_REGEX) ?? [];
  const set = [...new Set(matches.map((m) => m.toLowerCase()))];
  return { has: set.length >= 2, found: set };
}

const BANNED = [
  "bodrumun incisi", "muhteşem güzel", "unutulmaz tatil", "sizin için derledik",
  "şüphesiz ki", "kesinlikle harika", "muhakkak ki", "eşsiz güzellikler",
  "doyumsuz manzara", "cennetten bir köşe", "tarihi dokunun büyüsü",
  "tatil keyfini doyasıya", "unutamayacağınız", "ai olarak", "yapay zeka olarak",
];

function bannedHits(body: string): string[] {
  const lower = body.toLowerCase();
  return BANNED.filter((b) => lower.includes(b));
}

function qualityCheck(v: any, similarity: number) {
  const wc = countWords(v.body_md);
  const h2 = (v.body_md.match(/^## /gm) ?? []).length;
  const localSig = detectLocalSignals(v.body_md);
  const banned = bannedHits(v.body_md);
  const issues: string[] = [];

  if (wc < 800) issues.push(`word_count_low (${wc})`);
  if (wc > 2500) issues.push(`word_count_high (${wc})`);
  if (h2 < 3) issues.push(`h2_count_low (${h2})`);
  if ((v.image_slots ?? []).length < 4) issues.push("image_slots_low");
  if (!v.meta_description || v.meta_description.length < 140 || v.meta_description.length > 160)
    issues.push(`meta_description_length (${v.meta_description?.length})`);
  if ((v.faq ?? []).length < 2) issues.push("faq_low");
  if (!localSig.has) issues.push(`local_signals_low (${localSig.found.length})`);
  if (banned.length > 0) issues.push(`banned_phrases: ${banned.join("|")}`);
  if (similarity >= 0.3) issues.push(`similarity_high (${similarity.toFixed(2)})`);

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
    throw new Error(`Anthropic API error ${res.status}: ${t}`);
  }
  const data = await res.json();
  const text: string = data.content?.[0]?.text ?? "";
  return { text, usage: data.usage };
}

function parseAiJson(text: string): any {
  // Strip code fences if present
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("No JSON object in AI text: " + text.slice(0, 300));
  return JSON.parse(m[0]);
}

function buildUserPrompt(topic: string, category: string | null, brief: string | null, season: string) {
  return `KONU: ${topic}
${category ? `KATEGORİ: ${category}` : ""}
${brief ? `EK BRİEF: ${brief}` : ""}
SEZON: ${season}

Bu konuda yukarıdaki şemada bir blog yazısı üret.`;
}

function seasonFromMonth(m: number): string {
  if (m >= 3 && m <= 5) return "spring";
  if (m >= 6 && m <= 8) return "summer";
  if (m >= 9 && m <= 11) return "fall";
  return "winter";
}

// ---------- main handler -------------------------------------------------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const body = await req.json();
    const { topic_id, topic_text, category, brief } = body;

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // 1. Resolve topic
    let topic = topic_text as string | undefined;
    let topicCategory = category as string | undefined;
    let topicPoolId: string | null = null;

    if (topic_id) {
      const { data: poolRow, error } = await sb
        .from("blog_topic_pool")
        .select("*")
        .eq("id", topic_id)
        .single();
      if (error || !poolRow) throw new Error("topic_id not found");
      topic = poolRow.topic;
      topicCategory = topicCategory ?? poolRow.category ?? undefined;
      topicPoolId = poolRow.id;
    }

    if (!topic) throw new Error("topic_text or topic_id required");

    // 2. Create blog_posts row
    const { data: post, error: postErr } = await sb
      .from("blog_posts")
      .insert({
        topic,
        topic_category: topicCategory ?? null,
        brief: brief ?? null,
        status: "generating",
      })
      .select()
      .single();
    if (postErr || !post) throw new Error("blog_posts insert: " + postErr?.message);

    // Mark topic as used
    if (topicPoolId) {
      await sb
        .from("blog_topic_pool")
        .update({ used: true, used_in_post_id: post.id, used_at: new Date().toISOString() })
        .eq("id", topicPoolId);
    }

    // 3. Parallel Claude calls
    const month = new Date().getMonth() + 1;
    const season = seasonFromMonth(month);
    const userPrompt = buildUserPrompt(topic, topicCategory ?? null, brief ?? null, season);

    const [kiralamaRes, villaRes] = await Promise.allSettled([
      callClaude(KIRALAMA_PROMPT, userPrompt),
      callClaude(VILLA_PROMPT, userPrompt),
    ]);

    if (kiralamaRes.status === "rejected" || villaRes.status === "rejected") {
      const errs = [
        kiralamaRes.status === "rejected" ? "kiralama: " + kiralamaRes.reason : "",
        villaRes.status === "rejected" ? "villa: " + villaRes.reason : "",
      ].filter(Boolean).join(" | ");
      await sb.from("blog_posts").update({ status: "idea" }).eq("id", post.id);
      throw new Error("Claude call failed: " + errs);
    }

    const kiralamaJson = parseAiJson(kiralamaRes.value.text);
    const villaJson = parseAiJson(villaRes.value.text);

    // 4. Similarity
    const similarity = jaccardBigram(kiralamaJson.body_md, villaJson.body_md);

    // 5. Quality checks
    const qcKiralama = qualityCheck(kiralamaJson, similarity);
    const qcVilla = qualityCheck(villaJson, similarity);

    // 6. Cost
    const kInUsage = kiralamaRes.value.usage;
    const vInUsage = villaRes.value.usage;
    const cost =
      ((kInUsage?.input_tokens ?? 0) + (vInUsage?.input_tokens ?? 0)) * 0.000003 +
      ((kInUsage?.output_tokens ?? 0) + (vInUsage?.output_tokens ?? 0)) * 0.000015;

    // 7. Insert versions
    const buildRow = (j: any, site: string, qc: ReturnType<typeof qualityCheck>, usage: any) => ({
      post_id: post.id,
      site,
      title: j.title,
      slug: j.slug,
      meta_title: j.meta_title ?? j.title,
      meta_description: j.meta_description,
      excerpt: j.excerpt,
      body_md: j.body_md,
      word_count: qc.word_count,
      reading_time_min: qc.reading_time_min,
      hero_image: j.image_slots?.find((s: any) => s.position === "hero") ?? null,
      inline_images: j.image_slots ?? [],
      schema_jsonld: {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: j.title,
        description: j.meta_description,
        keywords: j.schema_keywords ?? [],
      },
      internal_links: j.internal_link_suggestions ?? [],
      faq: j.faq ?? [],
      similarity_to_sibling: similarity,
      has_local_signals: qc.has_local_signals,
      local_signals_found: qc.local_signals_found,
      passes_quality_gate: qc.passes,
      quality_issues: qc.issues,
      generation_model: MODEL,
      generation_tokens_input: usage?.input_tokens ?? null,
      generation_tokens_output: usage?.output_tokens ?? null,
      generation_cost_usd: cost / 2,
      status: "review",
    });

    const { error: insErr } = await sb.from("blog_site_versions").insert([
      buildRow(kiralamaJson, "bodrumapartkiralama", qcKiralama, kInUsage),
      buildRow(villaJson, "bodrumapartvilla", qcVilla, vInUsage),
    ]);

    if (insErr) throw new Error("Versions insert: " + insErr.message);

    await sb.from("blog_posts").update({ status: "review" }).eq("id", post.id);

    return new Response(
      JSON.stringify({
        ok: true,
        post_id: post.id,
        similarity,
        cost_usd: cost,
        quality: {
          bodrumapartkiralama: qcKiralama,
          bodrumapartvilla: qcVilla,
        },
      }),
      { headers: { ...CORS, "content-type": "application/json" } },
    );
  } catch (err) {
    console.error("[generate-blog-post] error", err);
    return new Response(
      JSON.stringify({ ok: false, error: (err as Error).message }),
      { status: 500, headers: { ...CORS, "content-type": "application/json" } },
    );
  }
});
