import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { formatDate, formatMoney } from "@/lib/format";
import type { Expense } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("expenses").select("*").order("date", { ascending: false }).limit(200);
  const list = (data ?? []) as Expense[];

  return (
    <>
      <PageHeader title="Giderler" desc="Son 200 gider satırı" />
      <div className="panel-card overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b border-[var(--color-border)] bg-navy-50/40 text-left text-[11px] uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Tarih</th>
              <th className="px-4 py-3">Açıklama</th>
              <th className="px-4 py-3">Kategori</th>
              <th className="px-4 py-3 text-right">Tutar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {list.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center text-muted">
                  Henüz gider yok.
                </td>
              </tr>
            ) : (
              list.map((e) => (
                <tr key={e.id} className="hover:bg-navy-50/40">
                  <td className="px-4 py-3 text-xs">{formatDate(e.date)}</td>
                  <td className="px-4 py-3">{e.description ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-muted">{e.category ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatMoney(Number(e.amount), e.currency)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
