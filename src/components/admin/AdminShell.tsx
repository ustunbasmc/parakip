"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Logo } from "@/components/Logo";
import {
  ActivityIcon,
  BuildingIcon,
  CreditCardIcon,
  GridIcon,
  HelpCircleIcon,
  ListIcon,
  MenuIcon,
  MessageIcon,
  SearchIcon,
  StarIcon,
  UsersIcon,
  XIcon,
} from "@/components/icons";

export interface AdminBadges {
  payments: number;
  support: number;
  deletions: number;
}

type NavItem = { href: string; label: string; icon: typeof GridIcon; badge?: keyof AdminBadges; exact?: boolean };

const NAV: { title: string; items: NavItem[] }[] = [
  { title: "Genel", items: [{ href: "/admin", label: "Genel bakış", icon: GridIcon, exact: true }] },
  {
    title: "Müşteriler",
    items: [
      { href: "/admin/users", label: "Kullanıcılar", icon: UsersIcon, badge: "deletions" },
      { href: "/admin/spaces", label: "Alanlar", icon: BuildingIcon },
    ],
  },
  {
    title: "Gelir",
    items: [
      { href: "/admin/subscriptions", label: "Abonelikler", icon: StarIcon },
      { href: "/admin/payments", label: "Havale talepleri", icon: CreditCardIcon, badge: "payments" },
    ],
  },
  {
    title: "Destek",
    items: [
      { href: "/admin/support", label: "Destek talepleri", icon: MessageIcon, badge: "support" },
      { href: "/admin/help", label: "Yardım merkezi", icon: HelpCircleIcon },
    ],
  },
  {
    title: "Sistem",
    items: [
      { href: "/admin/audit", label: "İşlem kaydı", icon: ListIcon },
      { href: "/admin/system", label: "Sistem durumu", icon: ActivityIcon },
    ],
  },
];

function isActive(pathname: string, item: NavItem) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function NavList({ pathname, badges, onNavigate }: { pathname: string; badges: AdminBadges; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-5" aria-label="Admin menüsü">
      {NAV.map((group) => (
        <div key={group.title}>
          <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted">{group.title}</p>
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const active = isActive(pathname, item);
              const count = item.badge ? badges[item.badge] : 0;
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
                      active ? "bg-accent-soft text-accent" : "text-text-secondary hover:bg-surface-muted hover:text-text-primary"
                    }`}
                  >
                    <Icon size={17} className="shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {count > 0 ? (
                      <span className="rounded-full bg-danger px-1.5 py-0.5 text-[10px] font-bold leading-none text-white tabular-nums">
                        {count > 99 ? "99+" : count}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function GlobalSearch({ onDone }: { onDone?: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        const v = q.trim();
        if (!v) return;
        onDone?.();
        router.push(`/admin/users?q=${encodeURIComponent(v)}`);
      }}
      className="relative min-w-0 flex-1"
    >
      <SearchIcon size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Kullanıcı ara: ad, e-posta, telefon, ID…"
        aria-label="Kullanıcı ara"
        className="h-10 w-full rounded-xl border border-border bg-surface pl-9 pr-3 text-sm text-text-primary placeholder:text-text-muted"
      />
    </form>
  );
}

/**
 * Admin paneli kabuğu: masaüstünde sabit sol menü + üst arama çubuğu,
 * mobilde açılır çekmece menü. Rozetler (bekleyen havale, açık destek
 * talebi, silme talebi) sunucuda hesaplanıp buraya verilir.
 */
export function AdminShell({ children, badges, adminEmail }: { children: ReactNode; badges: AdminBadges; adminEmail: string | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const brand = (
    <Link href="/admin" className="flex items-center gap-2" onClick={() => setOpen(false)}>
      <Logo withWordmark={false} className="scale-90" />
      <span className="text-sm font-extrabold text-text-primary">Parakip</span>
      <span className="rounded-md bg-accent px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-text-on-accent">Admin</span>
    </Link>
  );

  const footer = (
    <div className="flex flex-col gap-2 border-t border-border pt-4">
      {adminEmail ? <p className="truncate px-3 text-xs text-text-muted">{adminEmail}</p> : null}
      <Link href="/home" className="rounded-xl px-3 py-2 text-sm font-semibold text-accent hover:bg-surface-muted">
        ← Uygulamaya dön
      </Link>
    </div>
  );

  return (
    <div className="flex min-h-dvh shrink-0 bg-bg">
      {/* Masaüstü menü */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-6 overflow-y-auto border-r border-border bg-bg-elevated px-3 py-5 lg:flex">
        <div className="px-2">{brand}</div>
        <div className="flex-1">
          <NavList pathname={pathname} badges={badges} />
        </div>
        {footer}
      </aside>

      {/* Mobil çekmece */}
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Admin menüsü">
          <button type="button" aria-label="Menüyü kapat" className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col gap-6 overflow-y-auto bg-bg-elevated px-3 py-5 shadow-xl">
            <div className="flex items-center justify-between px-2">
              {brand}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Menüyü kapat"
                className="flex h-9 w-9 items-center justify-center rounded-full text-text-secondary hover:bg-surface-muted"
              >
                <XIcon size={18} />
              </button>
            </div>
            <div className="flex-1">
              <NavList pathname={pathname} badges={badges} onNavigate={() => setOpen(false)} />
            </div>
            {footer}
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-bg/85 px-4 py-3 backdrop-blur sm:px-6">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Menüyü aç"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface text-text-secondary lg:hidden"
          >
            <MenuIcon size={18} />
          </button>
          <div className="flex min-w-0 max-w-xl flex-1">
            <GlobalSearch />
          </div>
        </header>
        <main className="mx-auto w-full min-w-0 max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
