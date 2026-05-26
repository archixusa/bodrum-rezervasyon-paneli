import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import type { Reservation } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function GuestsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("reservations")
    .select("guest_name,guest_phone,guest_email,amount,currency,check_in")
    .order("check_in", { ascending: false })
    .limit(500);

  // Group by phone or email
  type GuestStat = {
    name: string;
    phone: string | null;
    email: string | null;
    visits: number;
    totalSpent: number;
    lastVisit: string;
  };
  const map = new Map<string, GuestStat>();
  for (const r of (data ?? []) as Pick<Reservation, "guest_name" | "guest_phone" | "guest_email" | "amount" | "currency" | "check_in">[]) {
    const key = (r.guest_phone ?? r.guest_email ?? r.guest_name).replace(/\s/g, "").toLowerCase();
    const existing = map.get(key);
    if (existing) {
      existing.visits += 1;
      existing.totalSpent += Number(r.amount || 0);
      if (r.check_in > existing.lastVisit) existing.lastVisit = r.check_in;
    } else {
      map.set(key, {
        name: r.guest_name,
        phone: r.guest_phone,
        email: r.guest_email,
        visits: 1,
        totalSpent: Number(r.amount || 0),
        lastVisit: r.check_in,
      });
    }
  }
  const guests = Array.from(map.values()).sort((a, b) => b.visits - a.visits);

  return (
    <>
      <PageHeader
        title="Misafirler (CRM)"
        desc="Telefon/e-posta üzerinden otomatik birleştirme"
      />
      <div className="panel-card overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-[var(--color-border)] bg-navy-50/40 text-left text-[11px] uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Misafir</th>
              <th className="px-4 py-3">Telefon</th>
              <th className="px-4 py-3">E-posta</th>
              <th className="px-4 py-3 text-right">Ziyaret</th>
              <th className="px-4 py-3 text-right">Toplam Harcama</th>
              <th className="px-4 py-3">Son</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {guests.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-muted">
                  Henüz misafir yok.
                </td>
              </tr>
            ) : (
              guests.map((g, i) => (
                <tr key={i} className="hover:bg-navy-50/40">
                  <td className="px-4 py-3 font-semibold">{g.name}</td>
                  <td className="px-4 py-3 text-xs">{g.phone ?? "—"}</td>
                  <td className="px-4 py-3 text-xs">{g.email ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
                    {g.visits > 1 ? (
                      <span className="badge bg-accent-500/15 text-accent-600">{g.visits}x VIP</span>
                    ) : (
                      g.visits
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(g.totalSpent)}
                  </td>
                  <td className="px-4 py-3 text-xs">{g.lastVisit}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
