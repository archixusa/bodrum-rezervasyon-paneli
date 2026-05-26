"use client";

import { useState, useEffect } from "react";
import { X, Phone, Mail, MessageCircle, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import type { ReservationRequest, RequestStatus } from "@/lib/types";
import { formatDate, formatDateTime, nightsBetween, SITE_LABELS } from "@/lib/format";

interface Props {
  request: ReservationRequest;
  onClose: () => void;
  onUpdateStatus: (status: RequestStatus) => void | Promise<void>;
  onSaveNote: (note: string) => void | Promise<void>;
}

export function RequestDetailDrawer({ request, onClose, onUpdateStatus, onSaveNote }: Props) {
  const [notes, setNotes] = useState(request.notes ?? "");
  const [saving, setSaving] = useState(false);
  const nights = nightsBetween(request.check_in, request.check_out);
  const site = SITE_LABELS[request.source_site] ?? { label: request.source_site, color: "bg-navy-50 text-navy-900" };

  useEffect(() => {
    setNotes(request.notes ?? "");
  }, [request.id, request.notes]);

  async function save() {
    setSaving(true);
    await onSaveNote(notes);
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-40 flex" role="dialog" aria-modal="true">
      <button
        onClick={onClose}
        className="flex-1 bg-black/30"
        aria-label="Kapat"
      />
      <aside className="flex w-full max-w-md flex-col overflow-y-auto bg-white shadow-cardHover">
        <header className="flex items-start justify-between gap-3 border-b border-[var(--color-border)] p-5">
          <div>
            <span className={`badge ${site.color}`}>{site.label}</span>
            <h2 className="mt-2 text-lg font-bold">{request.guest_name}</h2>
            <p className="text-xs text-muted">{formatDateTime(request.created_at)}</p>
          </div>
          <button onClick={onClose} className="rounded-md p-2 text-muted hover:bg-navy-50 hover:text-ink">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="space-y-4 p-5">
          <div className="grid grid-cols-2 gap-2">
            <a
              href={`tel:${request.guest_phone.replace(/\s/g, "")}`}
              className="panel-btn justify-center !bg-navy-900"
            >
              <Phone className="h-4 w-4" /> Ara
            </a>
            <a
              href={`https://wa.me/${request.guest_phone.replace(/\D/g, "")}?text=${encodeURIComponent(
                `Merhaba ${request.guest_name}, ${request.source_site} sitesinden gönderdiğiniz rezervasyon talebi için arıyorum.`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="panel-btn-accent justify-center !bg-[#25D366] hover:!bg-[#1DA851]"
            >
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </a>
          </div>

          <dl className="grid grid-cols-2 gap-y-3 text-sm">
            <DT>Telefon</DT>
            <DD>{request.guest_phone}</DD>
            <DT>E-posta</DT>
            <DD>
              {request.guest_email ? (
                <a href={`mailto:${request.guest_email}`} className="text-navy-600 hover:underline">
                  {request.guest_email}
                </a>
              ) : (
                "—"
              )}
            </DD>
            <DT>Giriş</DT>
            <DD>{formatDate(request.check_in)}</DD>
            <DT>Çıkış</DT>
            <DD>
              {formatDate(request.check_out)}
              {nights != null && <span className="ml-1 text-xs text-muted">({nights} gece)</span>}
            </DD>
            <DT>Kişi</DT>
            <DD>{request.guests_count ?? "—"}</DD>
            <DT>Bölge</DT>
            <DD>{request.region ?? "—"}</DD>
            <DT>Mülk slug</DT>
            <DD className="break-all">{request.property_slug ?? "—"}</DD>
            <DT>UTM</DT>
            <DD className="break-all text-xs">
              {[request.utm_source, request.utm_medium, request.utm_campaign].filter(Boolean).join(" · ") || "—"}
            </DD>
          </dl>

          {request.message && (
            <div className="rounded-md border border-[var(--color-border)] bg-navy-50/40 p-3 text-sm">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
                Misafir mesajı
              </p>
              {request.message}
            </div>
          )}

          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted">
              Dahili not
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="panel-input"
              placeholder="Aramada konuşuldu, fiyat verildi…"
            />
            <button onClick={save} disabled={saving} className="panel-btn-ghost mt-2">
              {saving && <Loader2 className="h-3 w-3 animate-spin" />}
              Notu kaydet
            </button>
          </div>

          <div className="border-t border-[var(--color-border)] pt-4">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
              Durum güncelle
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onUpdateStatus("contacted")}
                className="panel-btn-ghost justify-center"
              >
                İletişim Kuruldu
              </button>
              <button
                onClick={() => onUpdateStatus("converted")}
                className="panel-btn justify-center !bg-success hover:!bg-success/90"
              >
                <CheckCircle2 className="h-4 w-4" /> Rezervasyona Dönüştür
              </button>
              <button
                onClick={() => onUpdateStatus("rejected")}
                className="panel-btn justify-center !bg-danger hover:!bg-danger/90"
              >
                <XCircle className="h-4 w-4" /> Reddet
              </button>
              <button
                onClick={() => onUpdateStatus("spam")}
                className="panel-btn-ghost justify-center"
              >
                Spam İşaretle
              </button>
            </div>
          </div>

          <p className="text-[10px] text-muted">
            IP: {request.ip_address ?? "—"} · UA: {request.user_agent?.slice(0, 60) ?? "—"}
          </p>
        </div>
      </aside>
    </div>
  );
}

function DT({ children }: { children: React.ReactNode }) {
  return <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">{children}</dt>;
}
function DD({ children, className }: { children: React.ReactNode; className?: string }) {
  return <dd className={`text-sm ${className ?? ""}`}>{children}</dd>;
}
