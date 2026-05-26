"use client";

import { useMemo } from "react";
import clsx from "clsx";
import type { Property, Reservation } from "@/lib/types";

interface Props {
  properties: Property[];
  reservations: Reservation[];
  startDate: string;
  days: number;
}

export function CalendarGrid({ properties, reservations, startDate, days }: Props) {
  const start = new Date(startDate);
  const dates = useMemo(
    () =>
      Array.from({ length: days }, (_, i) => {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        return d;
      }),
    [start, days]
  );

  function isReserved(propertyId: string, date: Date): Reservation | null {
    const iso = date.toISOString().slice(0, 10);
    return (
      reservations.find(
        (r) => r.property_id === propertyId && r.check_in <= iso && r.check_out > iso
      ) ?? null
    );
  }

  if (properties.length === 0) {
    return (
      <div className="panel-card p-12 text-center text-muted">
        Henüz mülk yok. Mülk Yönetimi ekranından ekleyin.
      </div>
    );
  }

  return (
    <div className="panel-card overflow-x-auto">
      <div className="min-w-max">
        <div className="flex border-b border-[var(--color-border)]">
          <div className="sticky left-0 z-10 flex w-48 shrink-0 items-center border-r border-[var(--color-border)] bg-white px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
            Mülk
          </div>
          {dates.map((d, i) => {
            const isFirstOfMonth = d.getDate() === 1;
            return (
              <div
                key={i}
                className={clsx(
                  "w-7 shrink-0 border-r border-[var(--color-border)] py-1 text-center text-[10px]",
                  isFirstOfMonth && "border-l-2 border-l-navy-900 bg-navy-50",
                  d.getDay() === 0 && "bg-navy-50/40"
                )}
              >
                <div className="font-semibold">{d.getDate()}</div>
                <div className="text-muted">
                  {d.toLocaleDateString("tr-TR", { weekday: "narrow" })}
                </div>
              </div>
            );
          })}
        </div>
        {properties.map((p) => (
          <div key={p.id} className="flex border-b border-[var(--color-border)]">
            <div className="sticky left-0 z-10 flex w-48 shrink-0 items-center border-r border-[var(--color-border)] bg-white px-3 py-2 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium">{p.name}</p>
                <p className="text-[10px] uppercase tracking-wide text-muted">{p.type}</p>
              </div>
            </div>
            {dates.map((d, i) => {
              const r = isReserved(p.id, d);
              return (
                <div
                  key={i}
                  title={r ? `${r.guest_name} (${r.status})` : ""}
                  className={clsx(
                    "h-10 w-7 shrink-0 border-r border-[var(--color-border)]",
                    d.getDay() === 0 && "bg-navy-50/40",
                    r &&
                      (r.status === "confirmed"
                        ? "bg-success/30"
                        : r.status === "pending"
                        ? "bg-warning/30"
                        : "bg-navy-200")
                  )}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-4 border-t border-[var(--color-border)] p-3 text-[11px]">
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded bg-success/30" /> Onaylı
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded bg-warning/30" /> Bekliyor
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded border border-[var(--color-border)] bg-white" /> Müsait
        </span>
      </div>
    </div>
  );
}
