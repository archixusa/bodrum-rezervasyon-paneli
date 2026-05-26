"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Star,
  CheckCircle2,
  XCircle,
  Mail,
  Clock,
  ShieldAlert,
  Trash2,
  Send,
  Loader2,
} from "lucide-react";
import clsx from "clsx";
import { useToaster } from "@/components/Toaster";
import { formatDateTime, timeAgo } from "@/lib/format";
import type { ApartmentReview, ReviewInvitation } from "@/lib/types-reviews";
import type { Property } from "@/lib/types";

interface Props {
  initialReviews: ApartmentReview[];
  invitations: ReviewInvitation[];
  properties: Pick<Property, "id" | "name" | "slug">[];
}

type Tab = "pending" | "approved" | "rejected" | "invitations";

export function ReviewsClient({ initialReviews, invitations, properties }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const toaster = useToaster();
  const [reviews, setReviews] = useState<ApartmentReview[]>(initialReviews);
  const [tab, setTab] = useState<Tab>("pending");

  const propMap = useMemo(
    () => new Map(properties.map((p) => [p.id, p])),
    [properties]
  );

  const counts = useMemo(() => {
    return {
      pending: reviews.filter((r) => r.status === "pending").length,
      approved: reviews.filter((r) => r.status === "approved").length,
      rejected: reviews.filter((r) => r.status === "rejected").length,
      invitations: invitations.length,
    };
  }, [reviews, invitations]);

  const filtered = useMemo(() => {
    if (tab === "invitations") return [];
    return reviews.filter((r) => r.status === tab);
  }, [reviews, tab]);

  async function setStatus(id: string, status: ApartmentReview["status"], reason?: string) {
    const { error } = await supabase
      .from("apartment_reviews")
      .update({
        status,
        rejection_reason: status === "rejected" ? (reason ?? "manual_review") : null,
        approved_at: status === "approved" ? new Date().toISOString() : null,
      })
      .eq("id", id);
    if (error) {
      toaster.push({ title: "Güncellenemedi", body: error.message, variant: "error" });
      return;
    }
    setReviews((p) => p.map((r) => (r.id === id ? { ...r, status, rejection_reason: status === "rejected" ? (reason ?? "manual_review") : null } : r)));
    toaster.push({
      title: status === "approved" ? "✅ Onaylandı" : "❌ Reddedildi",
      variant: status === "approved" ? "success" : "warning",
    });
  }

  async function deleteReview(id: string) {
    if (!confirm("Yorumu kalıcı olarak sil?")) return;
    const { error } = await supabase.from("apartment_reviews").delete().eq("id", id);
    if (error) {
      toaster.push({ title: "Silinemedi", body: error.message, variant: "error" });
      return;
    }
    setReviews((p) => p.filter((r) => r.id !== id));
    toaster.push({ title: "Silindi", variant: "success" });
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-1 rounded-lg border border-[var(--color-border)] bg-white p-1">
        {([
            { v: "pending" as const, label: "Onay Bekleyen", icon: Clock, count: counts.pending, hot: counts.pending > 0 },
            { v: "approved" as const, label: "Onaylanmış", icon: CheckCircle2, count: counts.approved, hot: false },
            { v: "rejected" as const, label: "Reddedilmiş", icon: ShieldAlert, count: counts.rejected, hot: false },
            { v: "invitations" as const, label: "Davetiyeler", icon: Mail, count: counts.invitations, hot: false },
        ]).map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.v}
              onClick={() => setTab(t.v)}
              className={clsx(
                "flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition",
                tab === t.v
                  ? "bg-navy-900 text-white"
                  : t.hot
                  ? "bg-accent-500/10 text-accent-600 hover:bg-accent-500/20"
                  : "text-ink hover:bg-navy-50",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
              <span className="rounded bg-white/20 px-1.5 py-0.5 text-[10px]">
                {t.count}
              </span>
            </button>
          );
        })}
      </div>

      {tab === "invitations" ? (
        <InvitationsTable invitations={invitations} propMap={propMap} />
      ) : (
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="panel-card py-12 text-center text-muted">
              Bu filtreye uygun yorum yok.
            </div>
          ) : (
            filtered.map((r) => {
              const prop = propMap.get(r.property_id);
              return (
                <ReviewCard
                  key={r.id}
                  review={r}
                  propertyName={prop?.name ?? r.property_id.slice(0, 8)}
                  onApprove={() => setStatus(r.id, "approved")}
                  onReject={() => {
                    const reason = prompt("Reddetme nedeni (opsiyonel):") ?? undefined;
                    setStatus(r.id, "rejected", reason);
                  }}
                  onDelete={() => deleteReview(r.id)}
                />
              );
            })
          )}
        </div>
      )}
    </>
  );
}

function ReviewCard({
  review: r,
  propertyName,
  onApprove,
  onReject,
  onDelete,
}: {
  review: ApartmentReview;
  propertyName: string;
  onApprove: () => void;
  onReject: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="panel-card p-4">
      <header className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <RatingStars value={r.rating} />
            <span className="text-xs font-mono text-muted">{r.rating}/5</span>
            {r.display_mode === "anonymous" && (
              <span className="badge bg-navy-100 text-navy-700">Anonim</span>
            )}
            {r.status === "rejected" && r.rejection_reason === "spam_pattern" && (
              <span className="badge bg-danger/15 text-danger">🚫 Spam tespit</span>
            )}
          </div>
          {r.title && <h3 className="text-base font-semibold">{r.title}</h3>}
          <p className="text-xs text-muted">
            {propertyName} ·{" "}
            <span className="font-medium">
              {r.display_mode === "anonymous" ? "Anonim Misafir" : r.display_name ?? "Misafir"}
            </span>{" "}
            · {timeAgo(r.created_at)} · {r.source_site ?? "—"}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {r.status === "pending" && (
            <>
              <button onClick={onApprove} className="panel-btn !bg-success hover:!bg-success/90 !py-1.5 !text-xs">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Onayla
              </button>
              <button onClick={onReject} className="panel-btn-ghost !py-1.5 !text-xs">
                <XCircle className="h-3.5 w-3.5" />
                Reddet
              </button>
            </>
          )}
          {r.status === "approved" && (
            <button onClick={onReject} className="panel-btn-ghost !py-1.5 !text-xs">
              <XCircle className="h-3.5 w-3.5" />
              Geri Çek
            </button>
          )}
          {r.status === "rejected" && (
            <button onClick={onApprove} className="panel-btn-ghost !py-1.5 !text-xs">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Onayla
            </button>
          )}
          <button
            onClick={onDelete}
            className="rounded-md p-2 text-muted hover:bg-danger/10 hover:text-danger"
            title="Sil"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </header>

      <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{r.body}</p>

      <footer className="mt-3 flex flex-wrap gap-2 border-t border-[var(--color-border)] pt-2 text-[10px] text-muted">
        <span>IP: {r.ip_address ?? "—"}</span>
        <span>UA: {r.user_agent?.slice(0, 40) ?? "—"}</span>
        <span>Dil: {r.language}</span>
        {r.approved_at && <span>Onay: {formatDateTime(r.approved_at)}</span>}
      </footer>
    </article>
  );
}

function RatingStars({ value }: { value: number }) {
  return (
    <div className="flex">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={clsx("h-4 w-4", n <= value ? "fill-warning text-warning" : "text-navy-200")}
        />
      ))}
    </div>
  );
}

function InvitationsTable({
  invitations,
  propMap,
}: {
  invitations: ReviewInvitation[];
  propMap: Map<string, Pick<Property, "id" | "name" | "slug">>;
}) {
  const [sendingNew, setSendingNew] = useState(false);
  const supabase = useMemo(() => createClient(), []);
  const toaster = useToaster();
  const [showSendForm, setShowSendForm] = useState(false);
  const [list, setList] = useState(invitations);

  return (
    <div>
      <div className="panel-card mb-3 flex items-center justify-between p-3">
        <p className="text-sm text-muted">
          Toplam <span className="font-semibold text-ink">{list.length}</span> davetiye gönderildi · Kullanılan:{" "}
          <span className="font-semibold text-ink">{list.filter((i) => i.used_at).length}</span>
        </p>
        <button onClick={() => setShowSendForm(true)} className="panel-btn !py-1.5 !text-xs">
          <Send className="h-3.5 w-3.5" /> Yeni Davetiye Gönder
        </button>
      </div>

      {showSendForm && (
        <SendInvitationModal
          properties={[...propMap.values()]}
          onClose={() => setShowSendForm(false)}
          onSent={(inv) => {
            setList((p) => [inv, ...p]);
            setShowSendForm(false);
          }}
        />
      )}

      <div className="panel-card overflow-x-auto">
        <table className="w-full min-w-[700px] text-sm">
          <thead className="border-b border-[var(--color-border)] bg-navy-50/40 text-left text-[11px] uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Misafir</th>
              <th className="px-4 py-3">Mülk</th>
              <th className="px-4 py-3">Site</th>
              <th className="px-4 py-3">Gönderildi</th>
              <th className="px-4 py-3">Durum</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {list.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-muted">
                  Henüz davetiye gönderilmemiş.
                </td>
              </tr>
            ) : (
              list.map((i) => {
                const prop = propMap.get(i.property_id);
                return (
                  <tr key={i.id} className={i.used_at ? "opacity-50" : "hover:bg-navy-50/40"}>
                    <td className="px-4 py-3">
                      <p className="font-semibold">{i.guest_name ?? "—"}</p>
                      <p className="text-xs text-muted">{i.guest_email}</p>
                    </td>
                    <td className="px-4 py-3 text-xs">{prop?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-xs">{i.source_site ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-muted">{timeAgo(i.sent_at)}</td>
                    <td className="px-4 py-3">
                      {i.used_at ? (
                        <span className="badge bg-success/15 text-success">Yorum yazıldı</span>
                      ) : new Date(i.expires_at) < new Date() ? (
                        <span className="badge bg-navy-100 text-navy-700">Süresi doldu</span>
                      ) : (
                        <span className="badge bg-warning/15 text-warning">Bekliyor</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SendInvitationModal({
  properties,
  onClose,
  onSent,
}: {
  properties: Pick<Property, "id" | "name" | "slug">[];
  onClose: () => void;
  onSent: (inv: ReviewInvitation) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const toaster = useToaster();
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({
    property_id: properties[0]?.id ?? "",
    guest_email: "",
    guest_name: "",
    source_site: "bodrumapartkiralama",
    language: "tr",
  });

  async function submit() {
    if (!form.property_id || !form.guest_email) return;
    setSending(true);
    try {
      const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-review-invitation`;
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
          "apikey": process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
        },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error ?? "Hata");
      toaster.push({
        title: "📧 Davetiye gönderildi",
        body: `${form.guest_email} · Link: ${data.review_url}`,
        variant: "success",
      });
      // Refresh — reload list via API
      const { data: invs } = await supabase
        .from("review_invitations")
        .select("*")
        .eq("id", data.invitation_id)
        .single();
      if (invs) onSent(invs as ReviewInvitation);
    } catch (e) {
      toaster.push({ title: "Gönderilemedi", body: (e as Error).message, variant: "error" });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-cardHover">
        <h2 className="mb-3 text-lg font-bold">Değerlendirme Davetiyesi Gönder</h2>
        <div className="space-y-3 text-sm">
          <Field label="Mülk">
            <select
              value={form.property_id}
              onChange={(e) => setForm({ ...form, property_id: e.target.value })}
              className="panel-input"
            >
              {properties.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Misafir adı">
            <input
              value={form.guest_name}
              onChange={(e) => setForm({ ...form, guest_name: e.target.value })}
              placeholder="Örn: Ayşe Yılmaz"
              className="panel-input"
            />
          </Field>
          <Field label="E-posta *">
            <input
              type="email"
              value={form.guest_email}
              onChange={(e) => setForm({ ...form, guest_email: e.target.value })}
              required
              className="panel-input"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Site">
              <select
                value={form.source_site}
                onChange={(e) => setForm({ ...form, source_site: e.target.value })}
                className="panel-input"
              >
                <option value="bodrumapartkiralama">Apartkiralama</option>
                <option value="bodrumapartvilla">Apartvilla</option>
              </select>
            </Field>
            <Field label="Dil">
              <select
                value={form.language}
                onChange={(e) => setForm({ ...form, language: e.target.value })}
                className="panel-input"
              >
                <option value="tr">Türkçe</option>
                <option value="en">English</option>
              </select>
            </Field>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="panel-btn-ghost">İptal</button>
          <button onClick={submit} disabled={sending || !form.guest_email} className="panel-btn">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Gönder
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted">
        {label}
      </span>
      {children}
    </label>
  );
}
