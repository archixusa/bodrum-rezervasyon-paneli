import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { Inbox, CalendarCheck, Wallet, Percent } from "lucide-react";
import Link from "next/link";
import type { ReservationRequest } from "@/lib/types";
import { formatDate, formatMoney, SITE_LABELS, timeAgo } from "@/lib/format";

export default async function DashboardPage() {
  const supabase = await createClient();

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const startISO = startOfMonth.toISOString();

  const [requests, reservations, upcoming, newRequestsRes] = await Promise.all([
    supabase
      .from("reservation_requests")
      .select("id,status,created_at")
      .gte("created_at", startISO),
    supabase
      .from("reservations")
      .select("amount,commission_rate,created_at")
      .gte("created_at", startISO),
    supabase
      .from("upcoming_movements")
      .select("*")
      .limit(8),
    supabase
      .from("reservation_requests")
      .select("*")
      .eq("status", "new")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const monthRequests = requests.data ?? [];
  const monthReservations = reservations.data ?? [];
  const upcomingList = (upcoming.data ?? []) as Array<{
    id: string;
    property_name: string;
    guest_name: string;
    guest_phone: string;
    check_in: string;
    check_out: string;
    movement_type: "arrival" | "departure" | null;
  }>;

  const converted = monthRequests.filter((r) => r.status === "converted").length;
  const conversionRate =
    monthRequests.length > 0 ? Math.round((converted / monthRequests.length) * 100) : 0;
  const totalRevenue = monthReservations.reduce(
    (s: number, r) => s + Number(r.amount || 0),
    0
  );
  const estimatedCommission = monthReservations.reduce((s: number, r) => {
    const rate = r.commission_rate ?? 15;
    return s + Number(r.amount || 0) * (Number(rate) / 100);
  }, 0);

  const newRequests = newRequestsRes.data;

  return (
    <>
      <PageHeader
        title="Dashboard"
        desc="Ay özetin ve son hareketler"
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Bu ay yeni istek"
          value={monthRequests.length.toString()}
          icon={<Inbox className="h-5 w-5" />}
          href="/requests"
        />
        <KpiCard
          label="Dönüşüm oranı"
          value={`${conversionRate}%`}
          icon={<Percent className="h-5 w-5" />}
        />
        <KpiCard
          label="Bu ay rezervasyon"
          value={monthReservations.length.toString()}
          icon={<CalendarCheck className="h-5 w-5" />}
          href="/reservations"
        />
        <KpiCard
          label="Tahmini komisyon"
          value={formatMoney(estimatedCommission)}
          icon={<Wallet className="h-5 w-5" />}
          href="/finance"
          accent
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="panel-card p-5 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">Bekleyen istekler</h2>
              <p className="text-xs text-muted">En son işlenmemiş 10 istek</p>
            </div>
            <Link href="/requests" className="text-xs font-semibold text-navy-600 hover:underline">
              Tümünü gör →
            </Link>
          </div>
          {newRequests && newRequests.length > 0 ? (
            <ul className="divide-y divide-[var(--color-border)]">
              {(newRequests as ReservationRequest[]).map((r) => {
                const site = SITE_LABELS[r.source_site] ?? { label: r.source_site, color: "bg-navy-50 text-navy-900" };
                return (
                  <li key={r.id}>
                    <Link
                      href={`/requests?focus=${r.id}`}
                      className="flex items-center justify-between gap-3 py-3 hover:bg-navy-50/40"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`badge ${site.color}`}>{site.label}</span>
                          <span className="font-semibold">{r.guest_name}</span>
                          <span className="text-xs text-muted">{r.guest_phone}</span>
                        </div>
                        <p className="mt-1 text-xs text-muted">
                          {formatDate(r.check_in)} → {formatDate(r.check_out)} · {r.guests_count ?? "?"} kişi
                          {r.property_slug && ` · ${r.property_slug}`}
                        </p>
                      </div>
                      <span className="shrink-0 text-[11px] text-muted">{timeAgo(r.created_at)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="py-8 text-center text-sm text-muted">
              Bekleyen istek yok 🎉
            </p>
          )}
        </div>

        <div className="panel-card p-5">
          <h2 className="text-lg font-bold">Yaklaşan hareketler</h2>
          <p className="mb-3 text-xs text-muted">7 gün içinde giriş/çıkış</p>
          {upcomingList.length > 0 ? (
            <ul className="space-y-3">
              {upcomingList.map((u) => (
                <li key={u.id} className="rounded-md border border-[var(--color-border)] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`badge ${
                        u.movement_type === "arrival"
                          ? "bg-success/15 text-success"
                          : "bg-accent-500/15 text-accent-600"
                      }`}
                    >
                      {u.movement_type === "arrival" ? "Giriş" : "Çıkış"}
                    </span>
                    <span className="text-xs text-muted">
                      {formatDate(u.movement_type === "arrival" ? u.check_in : u.check_out)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-semibold">{u.property_name}</p>
                  <p className="text-xs text-muted">
                    {u.guest_name} · {u.guest_phone}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-8 text-center text-sm text-muted">
              Hareket yok
            </p>
          )}
        </div>
      </div>

      <p className="mt-8 text-xs text-muted">
        Toplam ay cirosu: <span className="font-semibold text-ink">{formatMoney(totalRevenue)}</span>
      </p>
    </>
  );
}

function KpiCard({
  label,
  value,
  icon,
  href,
  accent,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  href?: string;
  accent?: boolean;
}) {
  const inner = (
    <div className={`panel-card flex items-center gap-4 p-5 ${href ? "transition hover:shadow-cardHover" : ""}`}>
      <span
        className={`inline-flex h-10 w-10 items-center justify-center rounded-lg ${
          accent ? "bg-accent-500/15 text-accent-600" : "bg-navy-50 text-navy-900"
        }`}
      >
        {icon}
      </span>
      <div>
        <p className="text-[11px] uppercase tracking-wide text-muted">{label}</p>
        <p className="mt-0.5 text-xl font-bold tracking-tight">{value}</p>
      </div>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}
