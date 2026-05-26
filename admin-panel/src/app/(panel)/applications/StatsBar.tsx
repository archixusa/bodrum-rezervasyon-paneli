"use client";

import { useMemo } from "react";
import { Home, Sparkles, Calendar, TrendingUp } from "lucide-react";
import type { OwnerApplication } from "@/lib/types-owner";

export function StatsBar({ items }: { items: OwnerApplication[] }) {
  const stats = useMemo(() => {
    const now = Date.now();
    const day = 86400000;
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const t0 = todayStart.getTime();
    const w0 = now - 7 * day;

    const total = items.length;
    const newCount = items.filter((a) => a.status === "new").length;
    const today = items.filter((a) => new Date(a.created_at).getTime() >= t0).length;
    const week = items.filter((a) => new Date(a.created_at).getTime() >= w0).length;
    const converted = items.filter((a) => a.status === "converted_to_lead").length;
    const decided = items.filter((a) =>
      ["converted_to_lead", "rejected", "spam"].includes(a.status)
    ).length;
    const convRate = decided > 0 ? Math.round((converted / decided) * 100) : 0;

    return { total, newCount, today, week, converted, convRate };
  }, [items]);

  return (
    <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Card
        icon={<Sparkles className="h-5 w-5 text-accent-500" />}
        label="Yeni"
        value={stats.newCount}
        sub={`${stats.total} toplam başvuru`}
        accent="accent"
      />
      <Card
        icon={<Calendar className="h-5 w-5 text-success" />}
        label="Bugün"
        value={stats.today}
        sub={`Son 7 gün: ${stats.week}`}
      />
      <Card
        icon={<Home className="h-5 w-5 text-navy-700" />}
        label="Lead'e dönüşen"
        value={stats.converted}
        sub="Toplam"
      />
      <Card
        icon={<TrendingUp className="h-5 w-5 text-warning" />}
        label="Dönüşüm oranı"
        value={`${stats.convRate}%`}
        sub="Karara bağlananlar"
      />
    </div>
  );
}

function Card({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  sub: string;
  accent?: "accent";
}) {
  return (
    <div
      className={`panel-card flex items-center gap-3 p-4 ${
        accent === "accent" ? "ring-1 ring-accent-500/20" : ""
      }`}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-navy-50">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</p>
        <p className="text-2xl font-bold leading-tight">{value}</p>
        <p className="text-[11px] text-muted">{sub}</p>
      </div>
    </div>
  );
}
