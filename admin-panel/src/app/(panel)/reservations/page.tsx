import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { formatDate, formatMoney, nightsBetween } from "@/lib/format";
import type { Reservation, Property } from "@/lib/types";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  pending: { label: "Bekliyor", cls: "badge bg-warning/15 text-warning" },
  confirmed: { label: "Onaylı", cls: "badge bg-success/15 text-success" },
  completed: { label: "Tamamlandı", cls: "badge bg-navy-100 text-navy-800" },
  cancelled: { label: "İptal", cls: "badge bg-danger/15 text-danger" },
};

export default async function ReservationsPage() {
  const supabase = await createClient();
  const [{ data: reservations }, { data: properties }] = await Promise.all([
    supabase.from("reservations").select("*").order("check_in", { ascending: false }).limit(200),
    supabase.from("properties").select("id,name").limit(500),
  ]);

  const propMap = new Map((properties ?? []).map((p: Pick<Property, "id" | "name">) => [p.id, p.name]));
  const list = (reservations ?? []) as Reservation[];

  return (
    <>
      <PageHeader
        title="Rezervasyonlar"
        desc="Onaylanmış ve tamamlanmış rezervasyonlar"
      />
      <div className="panel-card overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="border-b border-[var(--color-border)] bg-navy-50/40 text-left text-[11px] uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Giriş</th>
              <th className="px-4 py-3">Çıkış</th>
              <th className="px-4 py-3">Mülk</th>
              <th className="px-4 py-3">Misafir</th>
              <th className="px-4 py-3">Gece</th>
              <th className="px-4 py-3 text-right">Tutar</th>
              <th className="px-4 py-3">Durum</th>
              <th className="px-4 py-3">Kaynak</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {list.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-muted">
                  Henüz rezervasyon yok.
                </td>
              </tr>
            ) : (
              list.map((r) => {
                const s = STATUS_LABELS[r.status] ?? STATUS_LABELS.pending;
                return (
                  <tr key={r.id} className="hover:bg-navy-50/40">
                    <td className="whitespace-nowrap px-4 py-3 text-xs">{formatDate(r.check_in)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs">{formatDate(r.check_out)}</td>
                    <td className="px-4 py-3 text-xs">{propMap.get(r.property_id) ?? r.property_id.slice(0, 8)}</td>
                    <td className="px-4 py-3 font-semibold">{r.guest_name}</td>
                    <td className="px-4 py-3 text-xs">{nightsBetween(r.check_in, r.check_out)}</td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {formatMoney(Number(r.amount), r.currency)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={s.cls}>{s.label}</span>
                    </td>
                    <td className="px-4 py-3 text-xs uppercase text-muted">{r.source}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
