// =========================================================================
// Edge Function: generate-property-content
// =========================================================================
// Body: { template_id: string, site: 'bodrumapartkiralama' | 'bodrumapartvilla' }
// Reads template + images, calls Anthropic Claude with site-specific persona,
// stores the result in property_site_versions.
// =========================================================================

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const MODEL = "claude-sonnet-4-20250514";

interface Template {
  id: string;
  internal_name: string;
  region: string;
  district: string | null;
  type: string;
  bedrooms: number | null;
  bathrooms: number | null;
  max_guests: number | null;
  size_m2: number | null;
  has_pool: boolean;
  pool_type: string | null;
  has_garden: boolean;
  distance_to_beach_m: number | null;
  distance_to_center_m: number | null;
  amenities: Record<string, unknown> | null;
  base_price_try: number | null;
  base_price_eur: number | null;
  raw_description: string | null;
  highlights: string[] | null;
}

interface PropertyImage {
  id: string;
  public_url: string;
  is_hero: boolean;
  display_order: number;
}

const PERSONA_PROMPTS: Record<string, string> = {
  bodrumapartkiralama: `
Sen bodrumapartkiralama.com için içerik yazıyorsun. Markanın tonu:
- Sıcak, samimi, pratik. Aile odaklı.
- Vurgu: fiyat-değer, çocuklu aile uygunluğu, çevre olanakları, kolaylık
- Cümle uzunluğu: 12-18 kelime ortalama. Kısa, akıcı.
- Yapı: Hero subtitle → Açılış paragrafı → Kimler için → Apart içi (oda, mutfak, banyo, manzara) → Çevre (plaj, market, ulaşım) → Pratik bilgiler → SSS
- Kaçınılan: aşırı şiirsel, soyut, dolgu cümleleri ("muhteşem", "büyüleyici", "olağanüstü" gibi içi boş sıfatlar — sadece somut bilgi ver)
- Misafire 2. tekil ile hitap et ("siz")
`,
  bodrumapartvilla: `
Sen bodrumapartvilla.com için içerik yazıyorsun. Markanın tonu:
- Şık, dingin, betimleyici. Lüks ve deneyim odaklı.
- Vurgu: mimari detaylar, manzara, atmosfer, yaşam tarzı, bal ayı/kurumsal grup
- Cümle uzunluğu: 20-30 kelime ortalama. Akıcı, edebi.
- Yapı: Hero (şiirsel açılış) → Atmosfer → Mimari ve iç tasarım → Yaşam alanları (ön kapıdan terasa kadar) → Konum karakteri → Konaklama deneyimi
- İzin verilen kelimeler: "atmosfer", "intima", "kavisli", "doğal taş", "Mediterranean", "boutique" — ama klişe değil, somut.
- Misafire 2. tekil ile hitap et ("siz"). Kullanım: "balkonunuzdan", "havuzunuzun kenarında"
`,
};

const JSON_SCHEMA_INSTRUCTION = `
Çıktın *sadece* aşağıdaki JSON formatında olmalı — açıklama, markdown, kod bloğu yok. Doğrudan JSON:

{
  "title": "50-60 karakter, SEO için, ana keyword başta, marka sonda",
  "slug": "url-slug-tirelerle-küçük-harfler",
  "meta_description": "140-160 karakter, CTA içersin, akıcı",
  "h1": "Sayfa başlığı, title'dan farklı olabilir",
  "hero_subtitle": "Hero altında, 80-120 karakter",
  "description_md": "Markdown formatında 400-600 kelime ana açıklama. ## ile alt başlıklar.",
  "highlights": ["en az 4, en çok 8 madde, her biri kısa benefit cümlesi"],
  "faq": [{"q": "soru", "a": "cevap"}, ...] (en az 4, en çok 6 soru, mülke özel),
  "featured_image_indices": [0, 2, 4] (öne çıkarılacak görsel sıraları, 3-5 adet)
}
`;

async function generateContent(template: Template, site: string, imageCount: number): Promise<{ json: any; tokens: number }> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY not set");
  }
  const persona = PERSONA_PROMPTS[site];
  if (!persona) throw new Error(`Unknown site: ${site}`);

  const facts = [
    `Mülk tipi: ${template.type}`,
    `Bölge: ${template.region}${template.district ? ` (${template.district})` : ""}`,
    template.bedrooms && `${template.bedrooms} yatak odası`,
    template.bathrooms && `${template.bathrooms} banyo`,
    template.max_guests && `Maks ${template.max_guests} misafir`,
    template.size_m2 && `${template.size_m2} m²`,
    template.has_pool && `Havuz: ${template.pool_type ?? "var"}`,
    template.has_garden && "Bahçe var",
    template.distance_to_beach_m && `Sahile ${template.distance_to_beach_m} m`,
    template.distance_to_center_m && `Merkeze ${template.distance_to_center_m} m`,
    template.base_price_try && `Yaklaşık fiyat: ₺${template.base_price_try}/gece`,
    template.amenities && `Donanımlar: ${JSON.stringify(template.amenities)}`,
    template.highlights?.length && `Vurgular: ${template.highlights.join(", ")}`,
  ]
    .filter(Boolean)
    .join("\n");

  const userPrompt = `
Aşağıdaki gerçek bilgilerden hareketle ${site} sitesi için içerik üret.

GERÇEKLER:
${facts}

HAM AÇIKLAMA (mülk sahibinden):
${template.raw_description ?? "(boş)"}

GÖRSEL SAYISI: ${imageCount}

${JSON_SCHEMA_INSTRUCTION}

ÖNEMLİ:
- Gerçeklere sadık kal, uydurma.
- Sahile/merkeze mesafeyi yuvarla (200 m → "200 metre")
- Yatak/banyo sayısı doğru olsun
- Slug benzersiz olmalı: bölge + tip + kısa açıklama (örn: "yalikavak-deniz-manzarali-2-1-havuzlu")
- featured_image_indices: 0 hero, 1-4 arası diğerleri, en fazla ${Math.min(imageCount - 1, 5)}'e kadar
`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      system: persona,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Anthropic ${res.status}: ${t}`);
  }
  const data = await res.json();
  const text = data.content?.[0]?.text ?? "";
  const tokens = (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0);

  let parsed: any;
  try {
    // Strip code fence if present
    const clean = text.trim().replace(/^```json\n?/, "").replace(/\n?```$/, "");
    parsed = JSON.parse(clean);
  } catch (err) {
    throw new Error(`Failed to parse JSON from model: ${(err as Error).message}\n\nGot: ${text.slice(0, 500)}`);
  }
  return { json: parsed, tokens };
}

async function fetchTemplate(template_id: string): Promise<Template | null> {
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/property_templates?id=eq.${template_id}&select=*`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
    }
  );
  const arr = await r.json();
  return arr?.[0] ?? null;
}

async function fetchImages(template_id: string): Promise<PropertyImage[]> {
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/property_images?template_id=eq.${template_id}&select=id,public_url,is_hero,display_order&order=display_order.asc`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
    }
  );
  return (await r.json()) ?? [];
}

async function upsertVersion(
  template_id: string,
  site: string,
  payload: any,
  featuredImages: string[],
  tokens: number
) {
  const body = {
    template_id,
    site,
    slug: payload.slug,
    title: payload.title,
    meta_description: payload.meta_description,
    h1: payload.h1,
    hero_subtitle: payload.hero_subtitle ?? null,
    description_md: payload.description_md,
    highlights: payload.highlights ?? [],
    faq: payload.faq ?? [],
    featured_images: featuredImages,
    schema_jsonld: {
      "@context": "https://schema.org",
      "@type": "LodgingBusiness",
      name: payload.title,
      description: payload.meta_description,
    },
    status: "review",
    generated_at: new Date().toISOString(),
    generation_model: MODEL,
    generation_tokens: tokens,
  };
  await fetch(
    `${SUPABASE_URL}/rest/v1/property_site_versions?on_conflict=template_id,site`,
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify(body),
    }
  );
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  let payload: { template_id?: string; site?: string };
  try {
    payload = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  const { template_id, site } = payload;
  if (!template_id || !site) {
    return new Response(JSON.stringify({ error: "template_id and site required" }), {
      status: 400,
    });
  }
  try {
    const template = await fetchTemplate(template_id);
    if (!template) return new Response("Template not found", { status: 404 });
    const images = await fetchImages(template_id);
    const { json, tokens } = await generateContent(template, site, images.length);
    const featuredImages = (json.featured_image_indices ?? [])
      .map((i: number) => images[i]?.public_url)
      .filter(Boolean);
    await upsertVersion(template_id, site, json, featuredImages, tokens);
    return new Response(
      JSON.stringify({ ok: true, slug: json.slug, tokens }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[generate]", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
