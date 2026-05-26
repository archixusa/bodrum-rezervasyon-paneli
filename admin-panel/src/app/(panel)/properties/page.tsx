import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { formatMoney } from "@/lib/format";
import type { Property, Owner } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PropertiesPage() {
  const supabase = await createClient();
  const [{ data: properties }, { data: owners }] = await Promise.all([
    supabase.from("properties").select("*").order("name"),
    supabase.from("owners").select("id,name"),
  ]);

  const ownerMap = new Map((owners ?? []).map((o: Pick<Owner, "id" | "name">) => [o.id, o.name]));
  const list = (properties ?? []) as Property[];

  return (
    <>
      <PageHeader
        title="Mülkler"
        desc="Site slug'larını mülklere bağlayın — bu eşleştirme yapılmazsa istekler 'genel' olarak düşer"
      />
      <div className="panel-card overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="border-b border-[var(--color-border)] bg-navy-50/40 text-left text-[11px] uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Ad</th>
              <th className="px-4 py-3">Tip</th>
              <th className="px-4 py-3">Bölge</th>
              <th className="px-4 py-3">Slug</th>
              <th className="px-4 py-3">Site</th>
              <th className="px-4 py-3">Sahip</th>
              <th className="px-4 py-3 text-right">Gece</th>
              <th className="px-4 py-3 text-right">Komisyon</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {list.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-muted">
                  Mülk yok. Supabase Studio'dan ekleyebilirsiniz.
                </td>
              </tr>
            ) : (
              list.map((p) => (
                <tr key={p.id} className="hover:bg-navy-50/40">
                  <td className="px-4 py-3 font-semibold">{p.name}</td>
                  <td className="px-4 py-3 text-xs uppercase">{p.type}</td>
                  <td className="px-4 py-3 text-xs">{p.district ?? "—"}</td>
                  <td className="break-all px-4 py-3 font-mono text-xs">{p.slug ?? "—"}</td>
                  <td className="px-4 py-3 text-xs">{p.source_site ?? "—"}</td>
                  <td className="px-4 py-3 text-xs">{p.owner_id ? ownerMap.get(p.owner_id) ?? "—" : "—"}</td>
                  <td className="px-4 py-3 text-right">
                    {p.nightly_price != null ? formatMoney(Number(p.nightly_price), p.currency) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-xs">%{p.commission_rate}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-xs text-muted">
        💡 Yeni mülk eklemenin en hızlı yolu Supabase Studio → Table Editor → properties.
        Bu panele eklemekten daha hızlı ve direkt RLS'e tabidir.
      </p>
    </>
  );
}
