import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { Phone, MessageCircle, ArrowUpRight, Building2 } from "lucide-react";
import { formatDateTime, timeAgo } from "@/lib/format";

interface Lead {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  region: string | null;
  property_type: string | null;
  property_count: number | null;
  source: string;
  status: string;
  created_at: string;
  notes: string | null;
}

export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<string, string> = {
  new: "badge-new",
  contacted: "badge-contacted",
  negotiating: "bg-warning/15 text-warning",
  converted: "badge-converted",
  rejected: "badge-rejected",
  lost: "badge-spam",
};

const SOURCE_BADGE: Record<string, string> = {
  inbound: "bg-success/15 text-success",
  referral: "bg-accent-500/15 text-accent-600",
  outreach: "bg-navy-100 text-navy-800",
  manual: "bg-muted/15 text-muted",
  google_maps: "bg-warning/15 text-warning",
  airbnb: "bg-danger/15 text-danger",
};

export default async function LeadsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("owner_leads")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  const leads = (data ?? []) as Lead[];
  const byStatus = {
    new: leads.filter((l) => l.status === "new").length,
    contacted: leads.filter((l) => l.status === "contacted").length,
    negotiating: leads.filter((l) => l.status === "negotiating").length,
    converted: leads.filter((l) => l.status === "converted").length,
  };

  return (
    <>
      <PageHeader
        title="Mülk Sahibi Lead'leri"
        desc="Inbound başvurular, referans gelenler, outreach'den dönenler ve manuel kaynaklı lead'ler"
        actions={
          <Link href="/leads/applications" className="panel-btn-ghost">
            <Building2 className="h-4 w-4" />
            Inbound Başvurular →
          </Link>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Yeni" value={String(byStatus.new)} />
        <Stat label="İletişim" value={String(byStatus.contacted)} />
        <Stat label="Müzakere" value={String(byStatus.negotiating)} accent />
        <Stat label="Dönüştü" value={String(byStatus.converted)} success />
      </div>

      <div className="panel-card overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="border-b border-[var(--color-border)] bg-navy-50/40 text-left text-[11px] uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Eklendi</th>
              <th className="px-4 py-3">Kaynak</th>
              <th className="px-4 py-3">İsim</th>
              <th className="px-4 py-3">İletişim</th>
              <th className="px-4 py-3">Bölge & Mülk</th>
              <th className="px-4 py-3">Durum</th>
              <th className="px-4 py-3 text-right">Eylem</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {leads.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-muted">
                  Lead yok. Başvurular sayfasından "Lead'e dönüştür" ile eklenir.
                </td>
              </tr>
            ) : (
              leads.map((l) => (
                <tr key={l.id} className="hover:bg-navy-50/40">
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-muted">
                    {timeAgo(l.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge ${SOURCE_BADGE[l.source] ?? "bg-muted/15 text-muted"}`}>
                      {l.source}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold">{l.name}</td>
                  <td className="px-4 py-3 text-xs">
                    {l.phone ?? "—"}
                    {l.email && <span className="block text-muted">{l.email}</span>}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {l.region ?? "—"}
                    {l.property_type && (
                      <span className="text-muted">
                        {" "}
                        · {l.property_type} × {l.property_count ?? 1}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge ${STATUS_BADGE[l.status] ?? "badge"}`}>
                      {l.status}
                    </span>
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      {l.phone && (
                        <>
                          <a
                            href={`tel:${l.phone.replace(/\s/g, "")}`}
                            className="rounded-md p-2 text-muted hover:bg-navy-100 hover:text-navy-900"
                          >
                            <Phone className="h-4 w-4" />
                          </a>
                          <a
                            href={`https://wa.me/${l.phone.replace(/\D/g, "")}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-md p-2 text-[#25D366] hover:bg-[#25D366]/10"
                          >
                            <MessageCircle className="h-4 w-4" />
                          </a>
                        </>
                      )}
                      <Link
                        href={`/leads/${l.id}`}
                        className="rounded-md p-2 text-navy-600 hover:bg-navy-100"
                      >
                        <ArrowUpRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Stat({
  label,
  value,
  accent,
  success,
}: {
  label: string;
  value: string;
  accent?: boolean;
  success?: boolean;
}) {
  return (
    <div className="panel-card p-4">
      <p className="text-[11px] uppercase tracking-wide text-muted">{label}</p>
      <p
        className={`mt-1 text-2xl font-bold tracking-tight ${
          accent ? "text-accent-600" : success ? "text-success" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}
