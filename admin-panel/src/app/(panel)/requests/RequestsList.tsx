"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Phone,
  MessageCircle,
  CheckCircle2,
  XCircle,
  StickyNote,
  Filter,
} from "lucide-react";
import clsx from "clsx";
import type { ReservationRequest, RequestStatus } from "@/lib/types";
import { formatDate, SITE_LABELS, timeAgo } from "@/lib/format";
import { useToaster } from "@/components/Toaster";
import { RequestDetailDrawer } from "./RequestDetailDrawer";

const STATUS_FILTERS: { value: RequestStatus | "all"; label: string }[] = [
  { value: "all", label: "Hepsi" },
  { value: "new", label: "Yeni" },
  { value: "contacted", label: "İletişim Kuruldu" },
  { value: "converted", label: "Rezervasyona Çevrildi" },
  { value: "rejected", label: "Reddedildi" },
  { value: "spam", label: "Spam" },
];

const SITE_FILTERS = ["all", "bodrumapartkiralama", "bodrumapartvilla", "bodrumacilsu", "bodruminsaatadilat"] as const;

export function RequestsList({ initial }: { initial: ReservationRequest[] }) {
  const params = useSearchParams();
  const focusId = params.get("focus");
  const supabase = useMemo(() => createClient(), []);
  const toaster = useToaster();
  const [items, setItems] = useState<ReservationRequest[]>(initial);
  const [statusFilter, setStatusFilter] = useState<RequestStatus | "all">("all");
  const [siteFilter, setSiteFilter] = useState<(typeof SITE_FILTERS)[number]>("all");
  const [selected, setSelected] = useState<ReservationRequest | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Auto-open if URL has ?focus=
  useEffect(() => {
    if (!focusId) return;
    const found = items.find((r) => r.id === focusId);
    if (found) setSelected(found);
  }, [focusId, items]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("reservation_requests")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "reservation_requests" },
        (payload) => {
          const r = payload.new as ReservationRequest;
          setItems((prev) => [r, ...prev]);
          audioRef.current?.play().catch(() => {});
          toaster.push({
            title: "🔔 Yeni rezervasyon isteği",
            body: `${r.guest_name} · ${SITE_LABELS[r.source_site]?.label ?? r.source_site}`,
            variant: "success",
          });
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification("Yeni rezervasyon isteği", {
              body: `${r.guest_name} (${r.guest_phone})`,
              icon: "/icon.svg",
            });
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "reservation_requests" },
        (payload) => {
          const r = payload.new as ReservationRequest;
          setItems((prev) => prev.map((x) => (x.id === r.id ? r : x)));
          if (selected?.id === r.id) setSelected(r);
        }
      )
      .subscribe();
    // Request browser notification permission
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  // Auto spam: same IP, 3+ requests in 10 min → mark spam (client-side check)
  useEffect(() => {
    const byIp = new Map<string, ReservationRequest[]>();
    for (const r of items) {
      if (r.status === "spam" || !r.ip_address) continue;
      const arr = byIp.get(r.ip_address) ?? [];
      arr.push(r);
      byIp.set(r.ip_address, arr);
    }
    Array.from(byIp.values()).forEach((arr) => {
      if (arr.length < 3) return;
      const sorted = [...arr].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      for (let i = 2; i < sorted.length; i++) {
        const window10 =
          new Date(sorted[i].created_at).getTime() - new Date(sorted[i - 2].created_at).getTime();
        if (window10 < 10 * 60 * 1000 && sorted[i].status === "new") {
          updateStatus(sorted[i].id, "spam");
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  async function updateStatus(id: string, status: RequestStatus) {
    const { error } = await supabase
      .from("reservation_requests")
      .update({ status })
      .eq("id", id);
    if (error) {
      toaster.push({ title: "Hata", body: error.message, variant: "error" });
    }
  }

  async function saveNote(id: string, notes: string) {
    const { error } = await supabase
      .from("reservation_requests")
      .update({ notes })
      .eq("id", id);
    if (error) toaster.push({ title: "Not kaydedilemedi", body: error.message, variant: "error" });
    else toaster.push({ title: "Not kaydedildi", variant: "success" });
  }

  const filtered = useMemo(() => {
    return items.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (siteFilter !== "all" && r.source_site !== siteFilter) return false;
      return true;
    });
  }, [items, statusFilter, siteFilter]);

  return (
    <>
      <audio ref={audioRef} src="/notification.mp3" preload="auto" />

      <div className="panel-card mb-4 flex flex-wrap items-center gap-3 p-3">
        <Filter className="h-4 w-4 text-muted" />
        <div className="flex flex-wrap gap-1">
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
        <div className="ml-auto flex flex-wrap gap-1">
          {SITE_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setSiteFilter(s)}
              className={clsx(
                "rounded-md px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide",
                siteFilter === s
                  ? "bg-accent-500 text-white"
                  : "bg-white text-ink hover:bg-navy-50"
              )}
            >
              {s === "all" ? "Tüm Siteler" : SITE_LABELS[s]?.label ?? s}
            </button>
          ))}
        </div>
      </div>

      <div className="panel-card overflow-x-auto">
        <table className="w-full min-w-[920px] text-sm">
          <thead className="border-b border-[var(--color-border)] bg-navy-50/40 text-left text-[11px] uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Tarih</th>
              <th className="px-4 py-3">Site</th>
              <th className="px-4 py-3">Misafir</th>
              <th className="px-4 py-3">Telefon</th>
              <th className="px-4 py-3">Tarihler</th>
              <th className="px-4 py-3">Mülk</th>
              <th className="px-4 py-3">Durum</th>
              <th className="px-4 py-3 text-right">Eylemler</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-muted">
                  Bu filtreye uygun istek yok.
                </td>
              </tr>
            ) : (
              filtered.map((r) => {
                const site = SITE_LABELS[r.source_site] ?? {
                  label: r.source_site,
                  color: "bg-navy-50 text-navy-900",
                };
                return (
                  <tr
                    key={r.id}
                    onClick={() => setSelected(r)}
                    className={clsx(
                      "cursor-pointer transition hover:bg-navy-50/40",
                      r.status === "new" && "bg-accent-500/5"
                    )}
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted">
                      {timeAgo(r.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge ${site.color}`}>{site.label}</span>
                    </td>
                    <td className="px-4 py-3 font-semibold">{r.guest_name}</td>
                    <td className="px-4 py-3 text-xs">{r.guest_phone}</td>
                    <td className="px-4 py-3 text-xs">
                      {formatDate(r.check_in)} → {formatDate(r.check_out)}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {r.property_slug ?? <span className="text-muted">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <a
                          href={`tel:${r.guest_phone.replace(/\s/g, "")}`}
                          className="rounded-md p-2 text-muted hover:bg-navy-100 hover:text-navy-900"
                          title="Ara"
                        >
                          <Phone className="h-4 w-4" />
                        </a>
                        <a
                          href={`https://wa.me/${r.guest_phone.replace(/\D/g, "")}?text=${encodeURIComponent(
                            `Merhaba ${r.guest_name}, ${r.source_site} sitesinden gönderdiğiniz rezervasyon talebi için arıyorum.`
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-md p-2 text-[#25D366] hover:bg-[#25D366]/10"
                          title="WhatsApp"
                        >
                          <MessageCircle className="h-4 w-4" />
                        </a>
                        <button
                          onClick={() => updateStatus(r.id, "converted")}
                          disabled={r.status === "converted"}
                          className="rounded-md p-2 text-success hover:bg-success/10 disabled:opacity-30"
                          title="Rezervasyona dönüştür"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => updateStatus(r.id, "rejected")}
                          disabled={r.status === "rejected" || r.status === "spam"}
                          className="rounded-md p-2 text-danger hover:bg-danger/10 disabled:opacity-30"
                          title="Reddet"
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setSelected(r)}
                          className="rounded-md p-2 text-navy-600 hover:bg-navy-100"
                          title="Detay / Not"
                        >
                          <StickyNote className="h-4 w-4" />
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
        <RequestDetailDrawer
          request={selected}
          onClose={() => setSelected(null)}
          onUpdateStatus={(status) => updateStatus(selected.id, status)}
          onSaveNote={(notes) => saveNote(selected.id, notes)}
        />
      )}
    </>
  );
}

function StatusBadge({ status }: { status: RequestStatus }) {
  const map: Record<RequestStatus, { label: string; cls: string }> = {
    new: { label: "Yeni", cls: "badge-new" },
    contacted: { label: "İletişim", cls: "badge-contacted" },
    converted: { label: "Rezervasyon", cls: "badge-converted" },
    rejected: { label: "Red", cls: "badge-rejected" },
    spam: { label: "Spam", cls: "badge-spam" },
  };
  const { label, cls } = map[status];
  return <span className={cls}>{label}</span>;
}
