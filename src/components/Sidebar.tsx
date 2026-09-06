"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Logo } from "./Logo";
import { PRIMARY_NAV_ITEMS, MORE_COMING_SOON_ITEMS, SPACE_AWARE_HREFS, getVisibleMoreItems } from "./navItems";

/**
 * Masaüstü sol sabit sidebar — mobildeki BottomNav'ın büyütülmüş hali
 * DEĞİL, ayrı bir deneyim: tüm öğeler (Borçlar, Raporlar, Alanlarım
 * dahil) tek listede, ayrıca bir "Daha Fazla" paneline gerek yok (yatay/
 * dikey alan sıkıntısı olmadığından). Aynı navItems.tsx kaynağını
 * kullanır — kod tekrarı yok.
 */
export function Sidebar({ activeSpaceType }: { activeSpaceType?: "home" | "business" }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentSpace = searchParams.get("space");

  const items = [...PRIMARY_NAV_ITEMS, ...getVisibleMoreItems(activeSpaceType)];

  function hrefFor(href: string) {
    return currentSpace && SPACE_AWARE_HREFS.has(href) ? `${href}?space=${currentSpace}` : href;
  }

  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-border bg-bg-elevated px-3 py-6 md:flex">
      <div className="px-3 pb-8">
        <Logo />
      </div>
      <nav aria-label="Ana navigasyon" className="flex min-w-0 flex-col gap-1">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={hrefFor(item.href)}
              aria-current={active ? "page" : undefined}
              className={`flex min-w-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                active ? "bg-accent-soft text-accent" : "text-text-secondary hover:bg-surface-muted hover:text-text-primary"
              }`}
            >
              {item.icon(active)}
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}

        {MORE_COMING_SOON_ITEMS.length > 0 ? (
          <>
            <p className="mb-1 mt-4 px-3 text-xs font-semibold uppercase tracking-wide text-text-muted">Yakında</p>
            {MORE_COMING_SOON_ITEMS.map((item) => (
              <div key={item.label} aria-disabled="true" className="flex min-w-0 items-center gap-3 rounded-xl px-3 py-2.5 opacity-60">
                {item.icon(false)}
                <span className="truncate text-sm font-medium text-text-secondary">{item.label}</span>
              </div>
            ))}
          </>
        ) : null}
      </nav>
    </aside>
  );
}
