import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { Plus, Sparkles, ExternalLink } from "lucide-react";
import { formatMoney } from "@/lib/format";
import type { Property, Owner } from "@/lib/types";
import type { PropertyTemplate, PropertySiteVersion } from "@/lib/types-property";

export const dynamic = "force-dynamic";

export default async function PropertiesPage() {
  const supabase = await createClient();
  const [{ data: properties }, { data: owners }, { data: templates }, { data: versions }] =
    await Promise.all([
      supabase.from("properties").select("*").order("name"),
      supabase.from("owners").select("id,name"),
      supabase
        .from("property_templates")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("property_site_versions")
        .select("template_id,site,status,published_url"),
    ]);

  const ownerMap = new Map(
    (owners ?? []).map((o: Pick<Owner, "id" | "name">) => [o.id, o.name])
  );
  const list = (properties ?? []) as Property[];
  const tList = (templates ?? []) as PropertyTemplate[];
  const versionsByTpl = new Map<string, PropertySiteVersion[]>();
  for (const v of (versions ?? []) as PropertySiteVersion[]) {
    const arr = versionsByTpl.get(v.template_id) ?? [];
    arr.push(v);
    versionsByTpl.set(v.template_id, arr);
  }

  return (
    <>
      <PageHeader
        title="Mülkler"
        desc="Mevcut mülkleri yönetin veya AI ile yeni mülk içeriği üretip iki siteye yayınlayın."
        actions={
          <Link href="/properties/new" className="panel-btn-accent">
            <Plus className="h-4 w-4" /> Yeni Mülk (AI)
          </Link>
        }
      />

      {/* AI Templates Section */}
      <section className="mb-8">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted">
          <Sparkles className="h-4 w-4 text-accent-500" />
          AI ile Üretilen İçerikler
        </h2>
        {tList.length === 0 ? (
          <div className="panel-card p-10 text-center text-muted text-sm">
            Henüz AI üretimi yok. Yeni Mülk butonundan başlayın.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {tList.map((t) => {
              const tplVersions = versionsByTpl.get(t.id) ?? [];
              return (
                <Link
                  href={`/properties/${t.id}/review`}
                  key={t.id}
                  className="panel-card flex flex-col gap-2 p-4 transition hover:shadow-cardHover"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold">{t.internal_name}</h3>
                    <span className={`badge ${statusBadge(t.status)}`}>{t.status}</span>
                  </div>
                  <p className="text-xs text-muted">
                    {t.type} · {t.region} {t.bedrooms ? `· ${t.bedrooms}+1` : ""}
                  </p>
                  <div className="mt-2 flex items-center gap-2 text-[11px]">
                    {tplVersions.map((v) => (
                      <span
                        key={v.site}
                        className={`badge ${
                          v.status === "published"
                            ? "bg-success/15 text-success"
                            : v.status === "review"
                            ? "bg-warning/15 text-warning"
                            : "bg-navy-100 text-navy-800"
                        }`}
                      >
                        {v.site.replace("bodrum", "")}: {v.status}
                      </span>
                    ))}
                    {tplVersions.length === 0 && (
                      <span className="text-muted">henüz site versiyonu yok</span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* Live properties (reservation-side) */}
      <h2 className="mb-3 mt-10 text-sm font-bold uppercase tracking-wide text-muted">
        Operasyondaki Mülkler
      </h2>
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
                  Operasyonda kayıtlı mülk yok.
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
                  <td className="px-4 py-3 text-xs">
                    {p.owner_id ? ownerMap.get(p.owner_id) ?? "—" : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {p.nightly_price != null
                      ? formatMoney(Number(p.nightly_price), p.currency)
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-xs">%{p.commission_rate}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function statusBadge(s: string) {
  switch (s) {
    case "draft":
      return "bg-navy-100 text-navy-800";
    case "generating":
      return "bg-accent-500/15 text-accent-600";
    case "review":
      return "bg-warning/15 text-warning";
    case "published":
      return "bg-success/15 text-success";
    default:
      return "bg-muted/15 text-muted";
  }
}
