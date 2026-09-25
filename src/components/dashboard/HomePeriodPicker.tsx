"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { HOME_PERIODS, HOME_PERIOD_LABELS, type HomePeriod } from "@/lib/format/homePeriod";

/**
 * Ana sayfa dönem sekmeleri (Bugün … Özel tarih). Gelir/gider/net
 * bölümünün başlığında durur: masaüstünde sağ üstte, dar ekranda başlığın
 * altında yana kaydırılabilir tek satır (hiçbir genişlikte taşmaz). Seçim
 * URL'ye yazılır (?period=…, özel için &from=&to=), sayfa yenilense de
 * korunur; diğer sorgu parametreleri (space) korunur.
 */
export function HomePeriodPicker({
  active,
  from,
  to,
}: {
  active: HomePeriod;
  from?: string;
  to?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [customOpen, setCustomOpen] = useState(active === "custom");
  const [fromValue, setFromValue] = useState(from ?? "");
  const [toValue, setToValue] = useState(to ?? "");
  const [error, setError] = useState<string | null>(null);
  const activeRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const highlighted = customOpen ? "custom" : active;

  // Dar ekranda seçili sekme görünür alanda olsun (ör. "Bu yıl" sağda kalmasın).
  // Yalnızca sekme satırı yatay kaydırılır; sayfanın dikey konumu değişmez.
  useEffect(() => {
    const list = listRef.current;
    const tab = activeRef.current;
    if (!list || !tab || list.scrollWidth <= list.clientWidth) return;
    list.scrollLeft = tab.offsetLeft - (list.clientWidth - tab.clientWidth) / 2;
  }, [highlighted]);

  function push(next: URLSearchParams) {
    const q = next.toString();
    startTransition(() => router.push(q ? `${pathname}?${q}` : pathname, { scroll: false }));
  }

  function select(period: HomePeriod) {
    if (period === "custom") {
      setCustomOpen(true);
      return;
    }
    setCustomOpen(false);
    const next = new URLSearchParams(searchParams.toString());
    next.delete("from");
    next.delete("to");
    if (period === "month") next.delete("period");
    else next.set("period", period);
    push(next);
  }

  function applyCustom(e: React.FormEvent) {
    e.preventDefault();
    if (!fromValue || !toValue) return setError("İki tarihi de seç.");
    if (fromValue > toValue) return setError("Başlangıç, bitişten sonra olamaz.");
    setError(null);
    const next = new URLSearchParams(searchParams.toString());
    next.set("period", "custom");
    next.set("from", fromValue);
    next.set("to", toValue);
    push(next);
  }

  return (
    <div className="flex min-w-0 flex-col gap-2 lg:items-end">
      <div
        ref={listRef}
        role="tablist"
        aria-label="Dönem"
        className={`relative flex min-w-0 max-w-full gap-1 overflow-x-auto rounded-2xl border border-border bg-surface p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
          pending ? "opacity-70" : ""
        }`}
      >
        {HOME_PERIODS.map((p) => {
          const isActive = p === highlighted;
          return (
            <button
              key={p}
              ref={isActive ? activeRef : undefined}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => select(p)}
              className={`shrink-0 whitespace-nowrap rounded-xl px-3 py-1.5 text-[13px] font-semibold transition-colors ${
                isActive ? "bg-accent text-text-on-accent" : "text-text-secondary hover:bg-surface-muted"
              }`}
              style={isActive ? { boxShadow: "var(--glow-accent)" } : undefined}
            >
              {HOME_PERIOD_LABELS[p]}
            </button>
          );
        })}
      </div>

      {customOpen ? (
        <form onSubmit={applyCustom} className="animate-rise flex w-full min-w-0 flex-col gap-2 rounded-2xl border border-border bg-surface p-3 lg:max-w-md">
          <div className="grid min-w-0 grid-cols-2 gap-2">
            <label className="flex min-w-0 flex-col gap-1 text-[11px] font-semibold text-text-muted">
              Başlangıç
              <input
                type="date"
                value={fromValue}
                max={toValue || undefined}
                onChange={(e) => setFromValue(e.target.value)}
                className="h-11 w-full min-w-0 rounded-xl border border-border bg-bg px-2 text-sm text-text-primary"
              />
            </label>
            <label className="flex min-w-0 flex-col gap-1 text-[11px] font-semibold text-text-muted">
              Bitiş
              <input
                type="date"
                value={toValue}
                min={fromValue || undefined}
                onChange={(e) => setToValue(e.target.value)}
                className="h-11 w-full min-w-0 rounded-xl border border-border bg-bg px-2 text-sm text-text-primary"
              />
            </label>
          </div>
          {error ? (
            <p role="alert" className="text-xs text-danger">
              {error}
            </p>
          ) : null}
          <button type="submit" disabled={pending} className="h-10 rounded-xl bg-accent text-sm font-bold text-text-on-accent disabled:opacity-60">
            Uygula
          </button>
        </form>
      ) : null}
    </div>
  );
}
