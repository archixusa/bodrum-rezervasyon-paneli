import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { Phone, MessageCircle, LogIn, LogOut } from "lucide-react";
import { formatDate, nightsBetween } from "@/lib/format";
import type { Reservation, Property } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CheckinPage() {
  const supabase = await createClient();
  const today = new Date();
  const start = today.toISOString().slice(0, 10);
  const end = new Date(today.getTime() + 7 * 86400000).toISOString().slice(0, 10);

  const [{ data: reservations }, { data: properties }] = await Promise.all([
    supabase
      .from("reservations")
      .select("*")
      .in("status", ["pending", "confirmed"])
      .or(
        `and(check_in.gte.${start},check_in.lte.${end}),and(check_out.gte.${start},check_out.lte.${end})`
      )
      .order("check_in"),
    supabase.from("properties").select("id,name"),
  ]);

  const propMap = new Map(
    (properties ?? []).map((p: Pick<Property, "id" | "name">) => [p.id, p.name])
  );
  const list = (reservations ?? []) as Reservation[];

  const arrivals = list.filter((r) => r.check_in >= start && r.check_in <= end);
  const departures = list.filter((r) => r.check_out >= start && r.check_out <= end);

  return (
    <>
      <PageHeader
        title="Giriş / Çıkış"
        desc="Önümüzdeki 7 gün içinde girişi/çıkışı olacak rezervasyonlar"
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Column
          title="Girişler"
          icon={<LogIn className="h-4 w-4 text-success" />}
          rows={arrivals}
          propMap={propMap}
          mode="arrival"
        />
        <Column
          title="Çıkışlar"
          icon={<LogOut className="h-4 w-4 text-accent-500" />}
          rows={departures}
          propMap={propMap}
          mode="departure"
        />
      </div>
    </>
  );
}

function Column({
  title,
  icon,
  rows,
  propMap,
  mode,
}: {
  title: string;
  icon: React.ReactNode;
  rows: Reservation[];
  propMap: Map<string, string>;
  mode: "arrival" | "departure";
}) {
  return (
    <div className="panel-card p-4">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted">
        {icon}
        {title} <span className="ml-auto text-xs">{rows.length}</span>
      </h2>
      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">7 gün içinde {title.toLowerCase()} yok.</p>
      ) : (
        <ul className="divide-y divide-[var(--color-border)]">
          {rows.map((r) => {
            const date = mode === "arrival" ? r.check_in : r.check_out;
            const dayLabel = humanDayLabel(date);
            return (
              <li key={r.id} className="py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">{r.guest_name}</p>
                  <span
                    className={`badge ${
                      dayLabel === "Bugün"
                        ? "bg-danger/15 text-danger"
                        : dayLabel === "Yarın"
                        ? "bg-warning/15 text-warning"
                        : "bg-navy-100 text-navy-800"
                    }`}
                  >
                    {dayLabel}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted">
                  {propMap.get(r.property_id) ?? r.property_id.slice(0, 8)} ·{" "}
                  {formatDate(date)}
                  {mode === "arrival" && r.check_out && (
                    <> · {nightsBetween(r.check_in, r.check_out)} gece</>
                  )}
                </p>
                {r.guest_phone && (
                  <div className="mt-2 flex items-center gap-1">
                    <a
                      href={`tel:${r.guest_phone.replace(/\s/g, "")}`}
                      className="rounded-md p-1.5 text-muted hover:bg-navy-100"
                    >
                      <Phone className="h-3.5 w-3.5" />
                    </a>
                    <a
                      href={`https://wa.me/${r.guest_phone.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-md p-1.5 text-[#25D366] hover:bg-[#25D366]/10"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                    </a>
                    <span className="text-xs text-muted">{r.guest_phone}</span>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function humanDayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return "Bugün";
  if (diff === 1) return "Yarın";
  if (diff === -1) return "Dün";
  if (diff < 0) return `${Math.abs(diff)} gün önce`;
  return `${diff} gün sonra`;
}
