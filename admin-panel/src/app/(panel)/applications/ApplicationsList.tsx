"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Phone,
  MessageCircle,
  CheckCircle2,
  XCircle,
  StickyNote,
  Filter,
  Home,
  ArrowUpRight,
} from "lucide-react";
import clsx from "clsx";
import type { OwnerApplication, OwnerApplicationStatus } from "@/lib/types-owner";
import { formatDateTime, timeAgo } from "@/lib/format";
import { useToaster } from "@/components/Toaster";

const STATUS_FILTERS: { value: OwnerApplicationStatus | "all"; label: string }[] = [
  { value: "all", label: "Hepsi" },
  { value: "new", label: "Yeni" },
  { value: "contacted", label: "İletişim Kuruldu" },
  { value: "converted_to_lead", label: "Lead'e Dönüştü" },
  { value: "rejected", label: "Reddedildi" },
  { value: "spam", label: "Spam" },
];

const SITE_BADGE: Record<string, { label: string; cls: string }> = {
  bodrumapartkiralama: { label: "Apartkiralama", cls: "bg-navy-100 text-navy-800" },
  bodrumapartvilla: { label: "Apartvilla", cls: "bg-accent-500/15 text-accent-600" },
};

export function ApplicationsList({ initial }: { initial: OwnerApplication[] }) {
  const supabase = useMemo(() => createClient(), []);
  const toaster = useToaster();
  const [items, setItems] = useState<OwnerApplication[]>(initial);
  const [statusFilter, setStatusFilter] = useState<OwnerApplicationStatus | "all">("all");
  const [selected, setSelected] = useState<OwnerApplication | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const channel = supabase
      .channel("owner_applications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "owner_applications" },
        (payload) => {
          const a = payload.new as OwnerApplication;
          setItems((p) => [a, ...p]);
          audioRef.current?.play().catch(() => {});
          toaster.push({
            title: "🏠 Yeni mülk sahibi başvurusu",
            body: `${a.name} · ${SITE_BADGE[a.source_site]?.label ?? a.source_site}`,
            variant: "success",
          });
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification("Yeni mülk sahibi başvurusu", {
              body: `${a.name} (${a.phone}) · ${a.region ?? ""}`,
              icon: "/icon.svg",
            });
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "owner_applications" },
        (payload) => {
          const a = payload.new as OwnerApplication;
          setItems((p) => p.map((x) => (x.id === a.id ? a : x)));
          if (selected?.id === a.id) setSelected(a);
        }
      )
      .subscribe();
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  async function updateStatus(id: string, status: OwnerApplicationStatus) {
    const { error } = await supabase
      .from("owner_applications")
      .update({ status })
      .eq("id", id);
    if (error) toaster.push({ title: "Hata", body: error.message, variant: "error" });
  }

  async function convertToLead(app: OwnerApplication) {
    const { data: lead, error: leadErr } = await supabase
      .from("owner_leads")
      .insert({
        name: app.name,
        phone: app.phone,
        email: app.email,
        region: app.region,
        property_type: app.property_type,
        property_count: app.property_count,
        source: app.referral_code ? "referral" : "inbound",
        status: "new",
        notes:
          [
            app.message,
            app.currently_renting && `Şu an kiralıyor: ${app.currently_renting}`,
            app.current_channels?.length && `Kanallar: ${app.current_channels.join(", ")}`,
            app.referral_code && `Referans kodu: ${app.referral_code}`,
          ]
            .filter(Boolean)
            .join("\n") || null,
      })
      .select()
      .single();
    if (leadErr || !lead) {
      toaster.push({ title: "Lead oluşturulamadı", body: leadErr?.message, variant: "error" });
      return;
    }
    const { error: updErr } = await supabase
      .from("owner_applications")
      .update({ status: "converted_to_lead", lead_id: lead.id })
      .eq("id", app.id);
    if (updErr) {
      toaster.push({ title: "Başvuru güncellenemedi", body: updErr.message, variant: "warning" });
      return;
    }
    toaster.push({ title: "Lead oluşturuldu", body: app.name, variant: "success" });
  }

  async function saveNote(id: string, notes: string) {
    const { error } = await supabase.from("owner_applications").update({ notes }).eq("id", id);
    if (error) toaster.push({ title: "Not kaydedilemedi", body: error.message, variant: "error" });
    else toaster.push({ title: "Not kaydedildi", variant: "success" });
  }

  const filtered = useMemo(
    () => items.filter((a) => statusFilter === "all" || a.status === statusFilter),
    [items, statusFilter]
  );

  return (
    <>
      <audio ref={audioRef} src="/notification.mp3" preload="auto" />

      <div className="panel-card mb-4 flex flex-wrap items-center gap-2 p-3">
        <Filter className="h-4 w-4 text-muted" />
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className={clsx(
              "rounded-md px-3 py-1.5 text-xs font-medium",
              statusFilter === f.value
                ? "bg-navy-900 text-white"
                : "bg-white text-ink hover:bg-navy-50"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="panel-card overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="border-b border-[var(--color-border)] bg-navy-50/40 text-left text-[11px] uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Zaman</th>
              <th className="px-4 py-3">Site</th>
              <th className="px-4 py-3">İsim & Telefon</th>
              <th className="px-4 py-3">Bölge & Mülk</th>
              <th className="px-4 py-3">Kanal</th>
              <th className="px-4 py-3">Durum</th>
              <th className="px-4 py-3 text-right">Eylemler</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-muted">
                  Bu filtreye uygun başvuru yok.
                </td>
              </tr>
            ) : (
              filtered.map((a) => {
                const site = SITE_BADGE[a.source_site] ?? {
                  label: a.source_site,
                  cls: "bg-navy-50 text-navy-900",
                };
                return (
                  <tr
                    key={a.id}
                    onClick={() => setSelected(a)}
                    className={clsx(
                      "cursor-pointer transition hover:bg-navy-50/40",
                      a.status === "new" && "bg-accent-500/5"
                    )}
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted">
                      {timeAgo(a.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge ${site.cls}`}>{site.label}</span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold">{a.name}</p>
                      <p className="text-xs text-muted">{a.phone}</p>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {a.region ?? "—"}
                      {a.property_type && (
                        <>
                          {" · "}
                          <span className="text-muted">
                            {a.property_type} × {a.property_count ?? 1}
                          </span>
                        </>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {a.currently_renting === "yes"
                        ? "Şu an kiralıyor"
                        : a.currently_renting === "no"
                        ? "Kiralamıyor"
                        : a.currently_renting === "planning"
                        ? "Planlıyor"
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={a.status} />
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <a
                          href={`tel:${a.phone.replace(/\s/g, "")}`}
                          className="rounded-md p-2 text-muted hover:bg-navy-100 hover:text-navy-900"
                          title="Ara"
                        >
                          <Phone className="h-4 w-4" />
                        </a>
                        <a
                          href={`https://wa.me/${a.phone.replace(/\D/g, "")}?text=${encodeURIComponent(
                            `Merhaba ${a.name}, ${a.source_site} sitesinden mülk sahibi başvurunuz için arıyorum.`
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-md p-2 text-[#25D366] hover:bg-[#25D366]/10"
                          title="WhatsApp"
                        >
                          <MessageCircle className="h-4 w-4" />
                        </a>
                        <button
                          onClick={() => convertToLead(a)}
                          disabled={a.status === "converted_to_lead"}
                          className="rounded-md p-2 text-success hover:bg-success/10 disabled:opacity-30"
                          title="Lead'e dönüştür"
                        >
                          <Home className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => updateStatus(a.id, "rejected")}
                          disabled={a.status === "rejected"}
                          className="rounded-md p-2 text-danger hover:bg-danger/10 disabled:opacity-30"
                          title="Reddet"
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <DetailDrawer
          application={selected}
          onClose={() => setSelected(null)}
          onUpdateStatus={(s) => updateStatus(selected.id, s)}
          onSaveNote={(n) => saveNote(selected.id, n)}
          onConvertToLead={() => convertToLead(selected)}
        />
      )}
    </>
  );
}

function StatusBadge({ status }: { status: OwnerApplicationStatus }) {
  const map: Record<OwnerApplicationStatus, { label: string; cls: string }> = {
    new: { label: "Yeni", cls: "badge-new" },
    contacted: { label: "İletişim", cls: "badge-contacted" },
    converted_to_lead: { label: "Lead", cls: "badge-converted" },
    rejected: { label: "Red", cls: "badge-rejected" },
    spam: { label: "Spam", cls: "badge-spam" },
  };
  const { label, cls } = map[status];
  return <span className={cls}>{label}</span>;
}

function DetailDrawer({
  application: a,
  onClose,
  onUpdateStatus,
  onSaveNote,
  onConvertToLead,
}: {
  application: OwnerApplication;
  onClose: () => void;
  onUpdateStatus: (s: OwnerApplicationStatus) => void;
  onSaveNote: (n: string) => void;
  onConvertToLead: () => void;
}) {
  const [notes, setNotes] = useState(a.notes ?? "");
  const site = SITE_BADGE[a.source_site] ?? {
    label: a.source_site,
    cls: "bg-navy-50 text-navy-900",
  };

  return (
    <div className="fixed inset-0 z-40 flex" role="dialog" aria-modal="true">
      <button onClick={onClose} className="flex-1 bg-black/30" aria-label="Kapat" />
      <aside className="flex w-full max-w-md flex-col overflow-y-auto bg-white shadow-cardHover">
        <header className="border-b border-[var(--color-border)] p-5">
          <div className="flex items-start justify-between">
            <div>
              <span className={`badge ${site.cls}`}>{site.label}</span>
              <h2 className="mt-2 text-lg font-bold">{a.name}</h2>
              <p className="text-xs text-muted">{formatDateTime(a.created_at)}</p>
            </div>
            <button onClick={onClose} className="rounded-md p-2 text-muted hover:bg-navy-50">
              <ArrowUpRight className="h-5 w-5 rotate-180" />
            </button>
          </div>
        </header>
        <div className="space-y-4 p-5 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <a
              href={`tel:${a.phone.replace(/\s/g, "")}`}
              className="panel-btn justify-center !bg-navy-900"
            >
              <Phone className="h-4 w-4" /> Ara
            </a>
            <a
              href={`https://wa.me/${a.phone.replace(/\D/g, "")}?text=${encodeURIComponent(
                `Merhaba ${a.name}, mülk sahibi başvurunuz için arıyorum.`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="panel-btn-accent justify-center !bg-[#25D366] hover:!bg-[#1DA851]"
            >
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </a>
          </div>

          <dl className="grid grid-cols-2 gap-y-2">
            <DT>Telefon</DT>
            <DD>{a.phone}</DD>
            <DT>E-mail</DT>
            <DD>{a.email ?? "—"}</DD>
            <DT>Bölge</DT>
            <DD>{a.region ?? "—"}</DD>
            <DT>Mülk tipi</DT>
            <DD>
              {a.property_type ?? "—"} × {a.property_count ?? 1}
            </DD>
            <DT>Şu an kiralıyor</DT>
            <DD>{a.currently_renting ?? "—"}</DD>
            <DT>Kanallar</DT>
            <DD>{a.current_channels?.join(", ") ?? "—"}</DD>
            <DT>Süre</DT>
            <DD>{a.ownership_duration ?? "—"}</DD>
            <DT>Referans</DT>
            <DD className="font-mono">{a.referral_code ?? "—"}</DD>
            <DT>UTM</DT>
            <DD className="break-all text-xs">{a.utm_source ?? "—"}</DD>
          </dl>

          {a.message && (
            <div className="rounded-md border border-[var(--color-border)] bg-navy-50/40 p-3 text-sm">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
                Başvuran mesajı
              </p>
              {a.message}
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
            />
            <button
              onClick={() => onSaveNote(notes)}
              className="panel-btn-ghost mt-2 text-xs"
            >
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
                onClick={onConvertToLead}
                disabled={a.status === "converted_to_lead"}
                className="panel-btn justify-center !bg-success hover:!bg-success/90 disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" /> Lead'e Dönüştür
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
                <StickyNote className="h-4 w-4" /> Spam
              </button>
            </div>
          </div>

          <p className="text-[10px] text-muted">
            IP: {a.ip_address ?? "—"} · UA: {a.user_agent?.slice(0, 60) ?? "—"}
          </p>
        </div>
      </aside>
    </div>
  );
}

function DT({ children }: { children: React.ReactNode }) {
  return (
    <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">{children}</dt>
  );
}
function DD({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <dd className={`text-sm ${className ?? ""}`}>{children}</dd>;
}
