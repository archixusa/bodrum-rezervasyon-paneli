"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToaster } from "@/components/Toaster";
import {
  Phone,
  MessageCircle,
  Mail,
  Sparkles,
  Loader2,
  Save,
  Copy,
  UserPlus,
} from "lucide-react";

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
  created_at: string;
}

type Channel = "whatsapp" | "email" | "call_script";

export function LeadDetailClient({ lead }: { lead: Lead }) {
  const supabase = createClient();
  const toaster = useToaster();
  const [notes, setNotes] = useState(lead.notes ?? "");
  const [status, setStatus] = useState(lead.status);
  const [channel, setChannel] = useState<Channel>("whatsapp");
  const [aiText, setAiText] = useState("");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  async function saveNotes() {
    setSaving(true);
    const { error } = await supabase
      .from("owner_leads")
      .update({ notes, status })
      .eq("id", lead.id);
    setSaving(false);
    if (error) toaster.push({ title: "Kaydedilemedi", body: error.message, variant: "error" });
    else toaster.push({ title: "Kaydedildi", variant: "success" });
  }

  async function generateAi() {
    setGenerating(true);
    setAiText("");
    const { data, error } = await supabase.functions.invoke("lead-ai-suggest", {
      body: { lead_id: lead.id, channel },
    });
    setGenerating(false);
    if (error) {
      toaster.push({ title: "AI hatası", body: error.message, variant: "error" });
      return;
    }
    setAiText((data as { text?: string })?.text ?? "");
  }

  async function convertToOwner() {
    const { data, error } = await supabase
      .from("owners")
      .insert({
        name: lead.name,
        phone: lead.phone,
        email: lead.email,
        notes: lead.notes,
      })
      .select()
      .single();
    if (error || !data) {
      toaster.push({ title: "Mülk sahibi oluşturulamadı", body: error?.message, variant: "error" });
      return;
    }
    await supabase
      .from("owner_leads")
      .update({ status: "converted" })
      .eq("id", lead.id);
    toaster.push({ title: "Mülk sahibi oluşturuldu", body: data.name, variant: "success" });
    setStatus("converted");
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      toaster.push({ title: "Kopyalandı", variant: "success" });
    });
  }

  const whatsappUrl = lead.phone
    ? `https://wa.me/${lead.phone.replace(/\D/g, "")}?text=${encodeURIComponent(aiText || "")}`
    : "";

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      {/* Left: details + AI assistant */}
      <div className="space-y-4">
        <div className="panel-card p-6">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Field label="Telefon">
              {lead.phone ? (
                <a href={`tel:${lead.phone.replace(/\s/g, "")}`} className="text-navy-600 hover:underline">
                  {lead.phone}
                </a>
              ) : "—"}
            </Field>
            <Field label="E-posta">
              {lead.email ? (
                <a href={`mailto:${lead.email}`} className="text-navy-600 hover:underline">
                  {lead.email}
                </a>
              ) : "—"}
            </Field>
            <Field label="Bölge">{lead.region ?? "—"}</Field>
            <Field label="Mülk">
              {lead.property_type ?? "—"} × {lead.property_count ?? 1}
            </Field>
            <Field label="Kaynak">{lead.source}</Field>
            <Field label="Eklendi">
              {new Date(lead.created_at).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })}
            </Field>
          </div>
        </div>

        {/* AI assistant */}
        <div className="panel-card p-6">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
            <Sparkles className="h-5 w-5 text-accent-500" />
            AI Asistan
          </h2>
          <p className="mb-4 text-sm text-muted">
            Bu lead'e özel mesaj/script üret. Mülk tipi, bölge ve önceki notlar otomatik kullanılır.
          </p>

          <div className="flex flex-wrap gap-2">
            {(["whatsapp", "email", "call_script"] as Channel[]).map((c) => (
              <button
                key={c}
                onClick={() => setChannel(c)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                  channel === c ? "bg-navy-900 text-white" : "bg-navy-50 text-ink"
                }`}
              >
                {c === "whatsapp" ? "WhatsApp" : c === "email" ? "E-mail" : "Telefon Scripti"}
              </button>
            ))}
            <button onClick={generateAi} disabled={generating} className="panel-btn-accent ml-auto">
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Üret
            </button>
          </div>

          {aiText && (
            <div className="mt-4 space-y-3">
              <textarea
                value={aiText}
                onChange={(e) => setAiText(e.target.value)}
                rows={10}
                className="panel-input font-mono text-sm leading-relaxed"
              />
              <div className="flex flex-wrap gap-2">
                <button onClick={() => copy(aiText)} className="panel-btn-ghost">
                  <Copy className="h-4 w-4" /> Kopyala
                </button>
                {channel === "whatsapp" && whatsappUrl && (
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="panel-btn-accent"
                  >
                    <MessageCircle className="h-4 w-4" /> WhatsApp'ta Aç
                  </a>
                )}
                {channel === "email" && lead.email && (
                  <a
                    href={`mailto:${lead.email}?body=${encodeURIComponent(aiText)}`}
                    className="panel-btn-accent"
                  >
                    <Mail className="h-4 w-4" /> Mail Aç
                  </a>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="panel-card p-6">
          <h2 className="mb-3 text-lg font-bold">Notlar</h2>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={6}
            className="panel-input"
            placeholder="Konuştuğum şeyler, müzakere notları, dikkat edilmesi gerekenler..."
          />
        </div>
      </div>

      {/* Right: status + actions */}
      <aside className="space-y-4">
        <div className="panel-card p-5">
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">Durum</h3>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="panel-input"
          >
            <option value="new">Yeni</option>
            <option value="contacted">İletişim kuruldu</option>
            <option value="negotiating">Müzakere</option>
            <option value="converted">Dönüştü</option>
            <option value="rejected">Reddedildi</option>
            <option value="lost">Kayıp</option>
          </select>
          <button onClick={saveNotes} disabled={saving} className="panel-btn mt-3 w-full">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Kaydet
          </button>
        </div>

        {lead.phone && (
          <div className="panel-card p-5">
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">Hızlı Eylemler</h3>
            <div className="space-y-2">
              <a
                href={`tel:${lead.phone.replace(/\s/g, "")}`}
                className="panel-btn w-full"
              >
                <Phone className="h-4 w-4" /> Ara
              </a>
              <a
                href={`https://wa.me/${lead.phone.replace(/\D/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="panel-btn-accent w-full !bg-[#25D366] hover:!bg-[#1DA851]"
              >
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </a>
              <button
                onClick={convertToOwner}
                disabled={status === "converted"}
                className="panel-btn-ghost w-full"
              >
                <UserPlus className="h-4 w-4" /> Mülk Sahibi'ne Dönüştür
              </button>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-0.5">{children}</p>
    </div>
  );
}
