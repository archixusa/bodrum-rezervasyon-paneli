import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { formatMoney, nightsBetween } from "@/lib/format";
import type { Reservation, Property, Owner } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const supabase = await createClient();
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [{ data: reservations }, { data: properties }, { data: owners }] = await Promise.all([
    supabase.from("reservations").select("*").gte("check_in", start.slice(0, 10)),
    supabase.from("properties").select("*"),
    supabase.from("owners").select("*"),
  ]);

  const propMap = new Map(((properties ?? []) as Property[]).map((p) => [p.id, p]));
  const ownerMap = new Map(((owners ?? []) as Owner[]).map((o) => [o.id, o]));

  // Group by owner
  const byOwner = new Map<
    string,
    { ownerId: string; ownerName: string; revenue: number; commission: number; count: number }
  >();

  for (const r of (reservations ?? []) as Reservation[]) {
    const prop = propMap.get(r.property_id);
    if (!prop || !prop.owner_id) continue;
    const owner = ownerMap.get(prop.owner_id);
    if (!owner) continue;
    const rate = Number(r.commission_rate ?? prop.commission_rate ?? 15);
    const amount = Number(r.amount || 0);
    const existing = byOwner.get(owner.id) ?? {
      ownerId: owner.id,
      ownerName: owner.name,
      revenue: 0,
      commission: 0,
      count: 0,
    };
    existing.revenue += amount;
    existing.commission += amount * (rate / 100);
    existing.count += 1;
    byOwner.set(owner.id, existing);
  }
  const rows = Array.from(byOwner.values()).sort((a, b) => b.revenue - a.revenue);

  return (
    <>
      <PageHeader
        title="Sahip Hesap Kesim Raporu"
        desc={`${now.toLocaleDateString("tr-TR", { month: "long", year: "numeric" })} ay sonu`}
      />
      <div className="panel-card overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b border-[var(--color-border)] bg-navy-50/40 text-left text-[11px] uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Sahip</th>
              <th className="px-4 py-3 text-right">Rezervasyon</th>
              <th className="px-4 py-3 text-right">Ciro</th>
              <th className="px-4 py-3 text-right">Komisyon</th>
              <th className="px-4 py-3 text-right">Sahibe Ödenecek</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-muted">
                  Bu ay hesaba katılacak rezervasyon yok.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.ownerId} className="hover:bg-navy-50/40">
                  <td className="px-4 py-3 font-semibold">{r.ownerName}</td>
                  <td className="px-4 py-3 text-right">{r.count}</td>
                  <td className="px-4 py-3 text-right">{formatMoney(r.revenue)}</td>
                  <td className="px-4 py-3 text-right text-accent-600">{formatMoney(r.commission)}</td>
                  <td className="px-4 py-3 text-right font-bold">{formatMoney(r.revenue - r.commission)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-xs text-muted">
        PDF export ve WhatsApp share desteği bir sonraki iterasyonda eklenecek — şimdilik bu tabloyu
        ekran görüntüsü olarak göndermek yeterli.
      </p>
    </>
  );
}
