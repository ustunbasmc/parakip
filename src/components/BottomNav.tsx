"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import {
  PRIMARY_NAV_ITEMS,
  MORE_COMING_SOON_ITEMS,
  SPACE_AWARE_HREFS,
  getVisibleMoreItems,
} from "./navItems";
import { MoreHorizontalIcon } from "./icons";

/**
 * Mobil alt navigasyon — 3 sabit sekme + "Daha Fazla" (gerçek animasyonlu
 * bottom sheet). Taşma/sıkışma olmaması için sekme sayısı SABİT tutulur;
 * yeni modüller MORE_NAV_ITEMS'a eklenerek büyür, alt navigasyona değil.
 */
export function BottomNav({ activeSpaceType }: { activeSpaceType?: "home" | "business" }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentSpace = searchParams.get("space");
  const moreItems = getVisibleMoreItems(activeSpaceType);

  // rendered: DOM'da var mı (kapanış animasyonu bitene kadar true kalır).
  // visible: transform sınıfı (translate-y-0 vs translate-y-full) — bir
  // sonraki frame'de true yapılarak CSS transition'ın gerçekten
  // ANİMASYON olarak görünmesi sağlanır (mount ile aynı frame'de
  // olsaydı tarayıcı transition'ı atlardı).
  const [rendered, setRendered] = useState(false);
  const [visible, setVisible] = useState(false);
  const pushedHistoryRef = useRef(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const isMoreActive = moreItems.some((item) => pathname === item.href || pathname.startsWith(item.href + "/"));

  function hrefFor(href: string) {
    return currentSpace && SPACE_AWARE_HREFS.has(href) ? `${href}?space=${currentSpace}` : href;
  }

  function open() {
    setRendered(true);
    window.history.pushState({ moreMenuOpen: true }, "");
    pushedHistoryRef.current = true;
    requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
  }

  function dismiss() {
    if (pushedHistoryRef.current) {
      window.history.back();
    }
    setVisible(false);
    setTimeout(() => setRendered(false), 250);
  }

  /**
   * GERÇEK navigasyon (bir modüle tıklama) — ASLA history.back() ile
   * YARIŞMAZ: geçici history girdisi (varsa) replaceState ile SESSİZCE
   * tüketilir, panel kapanış animasyonu senkron başlar, router.push
   * DOĞRUDAN (bekleme/popstate olmadan) çağrılır. Bkz. ProfileMenu/
   * SpaceSwitcher'daki aynı kök neden düzeltmesi — önceki sürümde
   * history.back()'in ASENKRON tamamlanması, bazen YANLIŞ bir sayfanın
   * bir an görünüp sonra düzelmesine yol açıyordu.
   */
  function navigateTo(href: string) {
    if (pushedHistoryRef.current) {
      window.history.replaceState(null, "", window.location.href);
      pushedHistoryRef.current = false;
    }
    setVisible(false);
    setTimeout(() => setRendered(false), 250);
    router.push(href);
  }

  useEffect(() => {
    function handlePopState() {
      pushedHistoryRef.current = false;
      setVisible(false);
      setTimeout(() => setRendered(false), 250);
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (!rendered) return;

    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) dismiss();
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") dismiss();
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [rendered]);

  return (
    <div className="md:hidden">
      {rendered ? (
        <>
          <div
            className={`fixed inset-0 z-40 bg-black/30 transition-opacity duration-250 ${visible ? "opacity-100" : "opacity-0"}`}
            aria-hidden="true"
          />
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Daha fazla"
            className={`fixed inset-x-0 bottom-0 z-50 flex max-h-[75dvh] flex-col overflow-hidden rounded-t-3xl border border-border bg-bg-elevated shadow-xl transition-transform duration-250 ease-out ${
              visible ? "translate-y-0" : "translate-y-full"
            }`}
          >
            <div className="mx-auto mt-2.5 h-1 w-9 shrink-0 rounded-full bg-border" aria-hidden="true" />
            <div className="min-h-0 flex-1 overflow-y-auto p-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                Diğer modüller
              </p>
              {moreItems.map((item) => (
                <button
                  key={item.href}
                  role="menuitem"
                  onClick={() => navigateTo(hrefFor(item.href))}
                  className="flex w-full min-w-0 items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-surface-muted"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                    {item.icon(false)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-text-primary">{item.label}</span>
                    {item.description ? (
                      <span className="block truncate text-xs text-text-muted">{item.description}</span>
                    ) : null}
                  </span>
                </button>
              ))}
              {MORE_COMING_SOON_ITEMS.map((item) => (
                <div
                  key={item.label}
                  aria-disabled="true"
                  className="flex w-full min-w-0 items-center gap-3 rounded-xl px-3 py-3 text-left opacity-60"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-muted text-text-muted">
                    {item.icon(false)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="block truncate text-sm font-semibold text-text-primary">{item.label}</span>
                      <span className="shrink-0 rounded-full bg-surface-muted px-1.5 py-0.5 text-[10px] font-bold text-text-muted">
                        Yakında
                      </span>
                    </span>
                    <span className="block truncate text-xs text-text-muted">{item.description}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : null}

      <nav
        aria-label="Ana navigasyon"
        className="sticky bottom-0 z-10 flex justify-around border-t border-border bg-bg-elevated pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5"
      >
        {PRIMARY_NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={hrefFor(item.href)}
              className={`flex min-w-[4.5rem] flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${
                active ? "text-accent" : "text-text-muted"
              }`}
              aria-current={active ? "page" : undefined}
            >
              {item.icon(active)}
              {item.label}
            </Link>
          );
        })}
        <button
          onClick={open}
          aria-haspopup="dialog"
          aria-expanded={rendered}
          className={`flex min-w-[4.5rem] flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${
            isMoreActive || rendered ? "text-accent" : "text-text-muted"
          }`}
        >
          <MoreHorizontalIcon size={22} />
          Daha Fazla
        </button>
      </nav>
    </div>
  );
}
