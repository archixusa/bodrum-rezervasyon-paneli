"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Inbox,
  CalendarDays,
  Building2,
  Users,
  UserCircle,
  TrendingUp,
  Receipt,
  FileBarChart,
  Settings,
  LogOut,
  Home,
  Target,
  Mail,
  DoorOpen,
  PenSquare,
  Star,
} from "lucide-react";
import clsx from "clsx";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const NAV = [
  { href: "/",                     label: "Dashboard",          icon: LayoutDashboard },
  { href: "/applications",         label: "Ev Sahibi Başvurusu", icon: Home },
  { href: "/requests",             label: "Rezervasyon İstek",  icon: Inbox },
  { href: "/leads",                label: "Lead Avcılığı",      icon: Target },
  { href: "/outreach",             label: "Partnership",       icon: Mail },
  { href: "/blog",                 label: "Blog",              icon: PenSquare },
  { href: "/reservations",         label: "Rezervasyonlar",    icon: CalendarDays },
  { href: "/checkin",              label: "Giriş / Çıkış",     icon: DoorOpen },
  { href: "/calendar",             label: "Takvim",            icon: CalendarDays },
  { href: "/properties",           label: "Mülkler",           icon: Building2 },
  { href: "/owners",               label: "Mülk Sahipleri",    icon: Users },
  { href: "/guests",               label: "Misafirler",        icon: UserCircle },
  { href: "/reviews",              label: "Yorumlar",          icon: Star },
  { href: "/finance",              label: "Finans",            icon: TrendingUp },
  { href: "/expenses",             label: "Giderler",          icon: Receipt },
  { href: "/reports",              label: "Raporlar",          icon: FileBarChart },
  { href: "/settings",             label: "Ayarlar",           icon: Settings },
];

export function Sidebar() {
  const path = usePathname();
  const router = useRouter();

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-[var(--color-border)] bg-white">
      <div className="flex h-16 items-center gap-2 border-b border-[var(--color-border)] px-5">
        <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-navy-900 text-sm font-bold text-white">
          BR
        </div>
        <div>
          <p className="text-xs font-bold leading-tight">Rezervasyon</p>
          <p className="text-[10px] uppercase tracking-wide text-muted">Yönetim Paneli</p>
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3 text-sm">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active =
            item.href === "/" ? path === "/" : path === item.href || path?.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "flex items-center gap-2.5 rounded-md px-3 py-2 font-medium transition",
                active
                  ? "bg-navy-900 text-white"
                  : "text-ink hover:bg-navy-50"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <button
        onClick={logout}
        className="flex items-center gap-2.5 border-t border-[var(--color-border)] px-5 py-3 text-sm font-medium text-muted hover:text-danger"
      >
        <LogOut className="h-4 w-4" />
        Çıkış Yap
      </button>
    </aside>
  );
}
