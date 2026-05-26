export function isValidTrPhone(s: string): boolean {
  if (!s) return false;
  const n = s.replace(/[\s().-]/g, "");
  if (/^\+?90?5\d{9}$/.test(n)) return true; // +90 5xx xxxxxxx or 905xx...
  if (/^05\d{9}$/.test(n)) return true;
  if (/^\+\d{8,15}$/.test(n)) return true; // international fallback
  return false;
}

export function todayISO(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

export function getUtmFromUrl(): {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
} {
  if (typeof window === "undefined") {
    return { utm_source: null, utm_medium: null, utm_campaign: null };
  }
  const qs = new URLSearchParams(window.location.search);
  return {
    utm_source: qs.get("utm_source"),
    utm_medium: qs.get("utm_medium"),
    utm_campaign: qs.get("utm_campaign"),
  };
}
