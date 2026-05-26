// =========================================================================
// Edge Function: lead-ai-suggest
// =========================================================================
// Body: { lead_id: string, channel: 'whatsapp' | 'email' | 'call_script' }
// Reads the lead + history, generates a tailored outreach message via Claude.
// =========================================================================

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const MODEL = "claude-sonnet-4-20250514";

interface Lead {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  region: string | null;
  property_type: string | null;
  property_count: number | null;
  source: string;
  status: string;
  notes: string | null;
}

const SYSTEM_PROMPT = `
Sen Furkan Şahin'in (Bodrumapartkiralama.com kurucusu) outreach asistanısın.
Mülk sahibi lead'lerine kişisel, samimi, kısa mesajlar yazarsın.

Stil kuralları:
- Türkçe, 2. tekil ("siz"), iş bilgisi olan ama yakın bir ton
- Asla "merhabalar değerli müşterimiz" gibi soğuk başlamayın
- Lead'in mülk tipini, bölgesini somut olarak referans alın
- Hard sell yapma, "tanışma" odaklı
- Max 4-5 cümle (whatsapp) veya 2 paragraf (email)
- Sonunda net bir CTA (random "ister misiniz?" değil; "yarın 16:00'da kısa bir kahve ister misiniz?" gibi)
- İmza: "Furkan Şahin, +90 538 512 40 88"
`;

async function fetchLead(id: string): Promise<Lead | null> {
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/owner_leads?id=eq.${id}&select=*`,
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

function buildUserPrompt(lead: Lead, channel: string): string {
  return `
LEAD BİLGİSİ:
- Ad: ${lead.name}
- Bölge: ${lead.region ?? "belirtilmemiş"}
- Mülk: ${lead.property_type ?? "belirtilmemiş"} × ${lead.property_count ?? 1}
- Kaynak: ${lead.source}
- Durum: ${lead.status}
- Önceki notlar: ${lead.notes ?? "(yok)"}

GÖREV: Bu lead'e ${
    channel === "whatsapp"
      ? "WhatsApp mesajı"
      : channel === "email"
      ? "ilk dokunuş e-postası"
      : "telefon scripti"
  } yaz.

${channel === "email" ? "Email ise: konu satırı + body olarak ver (\"Konu: ...\\n\\n...\" formatında)." : ""}
${channel === "call_script" ? "Telefon scripti ise: 3-4 cümlelik açılış + 2 olası itiraz ve verilecek cevaplar." : ""}
`;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  let body: { lead_id?: string; channel?: string };
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  const { lead_id, channel = "whatsapp" } = body;
  if (!lead_id) return new Response("lead_id required", { status: 400 });
  if (!ANTHROPIC_API_KEY)
    return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY not set" }), {
      status: 500,
    });

  try {
    const lead = await fetchLead(lead_id);
    if (!lead) return new Response("Lead not found", { status: 404 });
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: buildUserPrompt(lead, channel) }],
      }),
    });
    if (!r.ok) throw new Error(`Anthropic ${r.status}: ${await r.text()}`);
    const data = await r.json();
    const text = data.content?.[0]?.text ?? "";
    return new Response(
      JSON.stringify({ text, tokens: (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0) }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
