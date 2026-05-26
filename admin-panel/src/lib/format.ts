import type { Currency } from "./types";

export function formatMoney(value: number | null | undefined, currency: Currency = "TRY"): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  const [y, m, day] = d.split("T")[0].split("-");
  if (!y) return d;
  return `${day}.${m}.${y}`;
}

export function formatDateTime(d: string | null | undefined): string {
  if (!d) return "—";
  const date = new Date(d);
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Istanbul",
  }).format(date);
}

export function nightsBetween(checkin: string | null, checkout: string | null): number | null {
  if (!checkin || !checkout) return null;
  const a = new Date(checkin).getTime();
  const b = new Date(checkout).getTime();
  if (isNaN(a) || isNaN(b)) return null;
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

export function timeAgo(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 60) return "az önce";
  if (diff < 3600) return `${Math.floor(diff / 60)} dk önce`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} sa önce`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} gün önce`;
  return formatDate(date.toISOString());
}

export const SITE_LABELS: Record<string, { label: string; color: string }> = {
  bodrumapartkiralama: { label: "Apartkiralama", color: "bg-navy-100 text-navy-800" },
  bodrumapartvilla: { label: "Apartvilla", color: "bg-accent-500/15 text-accent-600" },
  bodrumacilsu: { label: "Acılsu", color: "bg-success/15 text-success" },
  bodruminsaatadilat: { label: "Adilat", color: "bg-warning/15 text-warning" },
};
