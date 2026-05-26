import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { formatMoney } from "@/lib/format";
import type { Reservation, Expense } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function FinancePage() {
  const supabase = await createClient();
  const now = new Date();
  const startISO = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [{ data: thisMonth }, { data: lastMonth }, { data: expenses }] = await Promise.all([
    supabase.from("reservations").select("*").gte("created_at", startISO),
    supabase.from("reservations").select("*").gte("created_at", lastMonthStart).lt("created_at", lastMonthEnd),
    supabase.from("expenses").select("*").gte("date", startISO.slice(0, 10)),
  ]);

  function totals(rows: Reservation[] | null | undefined) {
    const list = rows ?? [];
    const revenue = list.reduce((s, r) => s + Number(r.amount || 0), 0);
    const commission = list.reduce(
      (s, r) => s + Number(r.amount || 0) * (Number(r.commission_rate ?? 15) / 100),
      0
    );
    return { revenue, commission, count: list.length };
  }

  const cur = totals(thisMonth as Reservation[] | null);
  const prev = totals(lastMonth as Reservation[] | null);
  const expensesTotal = ((expenses ?? []) as Expense[]).reduce(
    (s, e) => s + Number(e.amount || 0),
    0
  );
  const trend = prev.commission > 0 ? Math.round(((cur.commission - prev.commission) / prev.commission) * 100) : null;

  return (
    <>
      <PageHeader title="Finans" desc="Bu ay vs. geçen ay komisyon raporu" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Bu ay rezervasyon" value={cur.count.toString()} sub={`Geçen ay: ${prev.count}`} />
        <Stat label="Bu ay ciro" value={formatMoney(cur.revenue)} />
        <Stat label="Bu ay komisyon" value={formatMoney(cur.commission)} sub={trend != null ? `${trend > 0 ? "+" : ""}${trend}% trend` : undefined} accent />
        <Stat label="Bu ay gider" value={formatMoney(expensesTotal)} sub="Aşağıdan ekle" />
      </div>
      <p className="mt-6 text-sm text-muted">
        Komisyon hesabı: mülk başına ayarlanmış oran (varsayılan %15) × rezervasyon tutarı.
        Detaylı dökümü <a className="text-navy-600 hover:underline" href="/reports">Raporlar</a> sayfasında.
      </p>
    </>
  );
}

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className="panel-card p-5">
      <p className="text-[11px] uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-bold tracking-tight ${accent ? "text-accent-600" : ""}`}>
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </div>
  );
}
