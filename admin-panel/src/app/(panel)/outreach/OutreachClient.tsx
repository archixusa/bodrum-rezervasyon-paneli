"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToaster } from "@/components/Toaster";
import {
  Plus,
  Play,
  Pause,
  Send,
  Trash2,
  Loader2,
  Mail,
  Building2,
  AlertTriangle,
} from "lucide-react";
import clsx from "clsx";
import type {
  OutreachTarget,
  OutreachSequence,
  OutreachSendLog,
} from "@/lib/types-outreach";
import { timeAgo } from "@/lib/format";

interface Props {
  targets: OutreachTarget[];
  totalCount: number;
  sequences: OutreachSequence[];
  recentSends: OutreachSendLog[];
  sentToday: number;
  capToday: number;
}

export function OutreachClient({
  targets: initial,
  totalCount,
  sequences,
  recentSends,
  sentToday,
  capToday,
}: Props) {
  const supabase = createClient();
  const toaster = useToaster();
  const [targets, setTargets] = useState(initial);
  const [adding, setAdding] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [selectedSequence, setSelectedSequence] = useState(sequences[0]?.id ?? "");
  const [working, setWorking] = useState(false);

  async function addBulk() {
    const lines = bulkText.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return;
    const rows = lines.map((line) => {
      const [email, company_name = "", contact_name = "", phone = ""] = line
        .split("|")
        .map((s) => s.trim());
      return { email, company_name: company_name || email, contact_name: contact_name || null, phone: phone || null };
    });
    const { data, error } = await supabase
      .from("outreach_targets")
      .upsert(rows, { onConflict: "email" })
      .select();
    if (error) {
      toaster.push({ title: "Eklenemedi", body: error.message, variant: "error" });
    } else {
      toaster.push({ title: `${data?.length ?? 0} hedef eklendi`, variant: "success" });
      setTargets((p) => [...(data ?? []), ...p]);
      setBulkText("");
      setAdding(false);
    }
  }

  async function enroll(targetIds: string[]) {
    if (!selectedSequence) {
      toaster.push({ title: "Sequence seçin", variant: "warning" });
      return;
    }
    setWorking(true);
    const rows = targetIds.map((id) => ({
      target_id: id,
      sequence_id: selectedSequence,
      next_send_at: new Date().toISOString(),
      current_step: 0,
      status: "active" as const,
    }));
    const { error } = await supabase.from("outreach_enrollments").insert(rows);
    if (error) {
      toaster.push({ title: "Sequence başlatılamadı", body: error.message, variant: "error" });
    } else {
      await supabase
        .from("outreach_targets")
        .update({ status: "queued" })
        .in("id", targetIds);
      toaster.push({
        title: `${targetIds.length} hedef sıraya alındı`,
        variant: "success",
      });
      setTargets((prev) =>
        prev.map((t) =>
          targetIds.includes(t.id) ? { ...t, status: "queued" } : t
        )
      );
    }
    setWorking(false);
  }

  async function runTick() {
    setWorking(true);
    try {
      // Use Next.js API route that proxies with server-side webhook secret.
      // Browser never sees the secret — security hardening.
      const res = await fetch("/api/outreach-tick", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      toaster.push({
        title: "Tick çalıştı",
        body: JSON.stringify(data).slice(0, 120),
        variant: "success",
      });
    } catch (e) {
      toaster.push({ title: "Tick başarısız", body: (e as Error).message, variant: "error" });
    } finally {
      setWorking(false);
    }
  }

  const newTargets = targets.filter((t) => t.status === "new");

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Toplam hedef" value={String(totalCount)} />
        <Stat label="Yeni" value={String(newTargets.length)} />
        <Stat label="Bugün gönderim" value={`${sentToday} / ${capToday}`} accent />
        <Stat label="Aktif sequence" value={String(sequences.filter((s) => s.is_active).length)} />
      </div>

      {/* Actions */}
      <div className="panel-card flex flex-wrap items-center gap-2 p-3">
        <select
          value={selectedSequence}
          onChange={(e) => setSelectedSequence(e.target.value)}
          className="panel-input !w-auto"
        >
          {sequences.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <button
          onClick={() => enroll(newTargets.map((t) => t.id))}
          disabled={newTargets.length === 0 || working}
          className="panel-btn-accent"
        >
          <Play className="h-4 w-4" />
          Tüm yeniler için sequence başlat ({newTargets.length})
        </button>
        <button onClick={runTick} disabled={working} className="panel-btn-ghost">
          {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Tick'i şimdi çalıştır
        </button>
        <button onClick={() => setAdding((v) => !v)} className="panel-btn">
          <Plus className="h-4 w-4" />
          Toplu hedef ekle
        </button>
      </div>

      {adding && (
        <div className="panel-card space-y-2 p-4">
          <p className="text-sm font-semibold">
            Format: <code className="rounded bg-navy-50 px-1">email | şirket | kişi | telefon</code> — her satır bir hedef
          </p>
          <textarea
            rows={8}
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            className="panel-input font-mono text-xs"
            placeholder="info@example.com | Otel Adı | Ali Veli | +90 5xx&#10;sales@partner.com | Tekne Şirketi | | "
          />
          <div className="flex gap-2">
            <button onClick={addBulk} className="panel-btn-accent">
              Ekle
            </button>
            <button onClick={() => setAdding(false)} className="panel-btn-ghost">
              İptal
            </button>
          </div>
          <p className="flex items-center gap-2 text-xs text-warning">
            <AlertTriangle className="h-4 w-4" /> Sadece tüzel kişi/işletme adresleri ekle. Bireysel mail eklemek KVKK ihlali.
          </p>
        </div>
      )}

      {/* Targets table */}
      <div className="panel-card overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="border-b border-[var(--color-border)] bg-navy-50/40 text-left text-[11px] uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Şirket</th>
              <th className="px-4 py-3">E-posta</th>
              <th className="px-4 py-3">Kategori</th>
              <th className="px-4 py-3">Bölge</th>
              <th className="px-4 py-3">Durum</th>
              <th className="px-4 py-3">Eklendi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {targets.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-muted">
                  Hedef yok. Toplu hedef ekle ile başlayın.
                </td>
              </tr>
            ) : (
              targets.map((t) => (
                <tr key={t.id} className="hover:bg-navy-50/40">
                  <td className="px-4 py-3">
                    <p className="font-semibold">{t.company_name}</p>
                    {t.contact_name && (
                      <p className="text-xs text-muted">{t.contact_name}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <a href={`mailto:${t.email}`} className="text-navy-600 hover:underline">
                      {t.email}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-xs">{t.category ?? "—"}</td>
                  <td className="px-4 py-3 text-xs">{t.region ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${statusCls(t.status)}`}>{t.status}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted">{timeAgo(t.created_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Recent sends */}
      {recentSends.length > 0 && (
        <div className="panel-card p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted">
            <Mail className="h-4 w-4" /> Son gönderimler
          </h2>
          <ul className="divide-y divide-[var(--color-border)]">
            {recentSends.slice(0, 10).map((s) => (
              <li key={s.id} className="flex items-center justify-between py-2 text-xs">
                <span className="flex-1 truncate">{s.subject}</span>
                <span className={`badge ${sendStatusCls(s.status)}`}>{s.status}</span>
                <span className="ml-3 text-muted">{timeAgo(s.sent_at)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function statusCls(s: string) {
  switch (s) {
    case "new":
      return "badge-new";
    case "queued":
      return "bg-navy-100 text-navy-800";
    case "contacted":
      return "badge-contacted";
    case "replied":
      return "bg-accent-500/15 text-accent-600";
    case "converted":
      return "badge-converted";
    case "unsubscribed":
    case "suppressed":
      return "badge-spam";
    case "bounced":
      return "badge-rejected";
    default:
      return "bg-muted/15 text-muted";
  }
}

function sendStatusCls(s: string) {
  switch (s) {
    case "sent":
      return "bg-success/15 text-success";
    case "bounced":
    case "failed":
      return "bg-danger/15 text-danger";
    case "suppressed":
      return "bg-muted/15 text-muted";
    default:
      return "bg-navy-100 text-navy-800";
  }
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="panel-card p-4">
      <p className="text-[11px] uppercase tracking-wide text-muted">{label}</p>
      <p
        className={`mt-1 text-2xl font-bold tracking-tight ${
          accent ? "text-accent-600" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}
