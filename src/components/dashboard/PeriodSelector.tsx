"use client";

import { useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { PERIOD_LABELS, type DashboardPeriod } from "@/lib/format/date";

const OPTIONS: DashboardPeriod[] = ["today", "week", "month", "year"];

/**
 * Dashboard'daki gelir/gider/net değişim için zaman aralığı seçici.
 * Seçim URL'nin ?period= parametresine yazılır (sayfa yenilendiğinde
 * korunur). Tek satır, 4 eşit sütun (min-w-0 + truncate) — dar ekranda
 * bile yatay taşma OLMAZ. Seçim anında vurgulanır; yeni veri gelene kadar
 * satır hafifçe soluklaşır (bekleme hissi yerine anında geri bildirim).
 */
export function PeriodSelector({ active }: { active: DashboardPeriod }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useState<DashboardPeriod | null>(null);
  const shown = pending && optimistic ? optimistic : active;

  function select(period: DashboardPeriod) {
    if (period === active) return;
    setOptimistic(period);
    const next = new URLSearchParams(searchParams.toString());
    if (period === "month") next.delete("period");
    else next.set("period", period);
    startTransition(() => router.push(`${pathname}?${next.toString()}`, { scroll: false }));
  }

  return (
    <div
      role="tablist"
      aria-label="Zaman aralığı"
      aria-busy={pending}
      className={`grid grid-cols-4 gap-1 rounded-2xl border border-border bg-surface p-1 transition-opacity ${pending ? "opacity-70" : ""}`}
    >
      {OPTIONS.map((period) => {
        const isActive = period === shown;
        return (
          <button
            key={period}
            role="tab"
            aria-selected={isActive}
            onClick={() => select(period)}
            className={`min-w-0 truncate rounded-xl px-1 py-2 text-[13px] font-semibold transition-colors ${
              isActive ? "bg-accent text-text-on-accent" : "text-text-secondary hover:bg-surface-muted"
            }`}
            style={isActive ? { boxShadow: "var(--glow-accent)" } : undefined}
          >
            {PERIOD_LABELS[period]}
          </button>
        );
      })}
    </div>
  );
}
