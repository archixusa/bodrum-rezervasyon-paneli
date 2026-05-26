import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import type { Owner } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function OwnersPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("owners").select("*").order("name");
  const list = (data ?? []) as Owner[];

  return (
    <>
      <PageHeader title="Mülk Sahipleri" desc="İletişim ve ödeme bilgileri" />
      <div className="panel-card overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-[var(--color-border)] bg-navy-50/40 text-left text-[11px] uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Ad</th>
              <th className="px-4 py-3">Telefon</th>
              <th className="px-4 py-3">E-posta</th>
              <th className="px-4 py-3">IBAN</th>
              <th className="px-4 py-3">Not</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {list.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-muted">
                  Henüz mülk sahibi yok.
                </td>
              </tr>
            ) : (
              list.map((o) => (
                <tr key={o.id} className="hover:bg-navy-50/40">
                  <td className="px-4 py-3 font-semibold">{o.name}</td>
                  <td className="px-4 py-3 text-xs">
                    {o.phone ? <a className="text-navy-600 hover:underline" href={`tel:${o.phone}`}>{o.phone}</a> : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {o.email ? <a className="text-navy-600 hover:underline" href={`mailto:${o.email}`}>{o.email}</a> : "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{o.iban ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-muted">{o.notes ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
