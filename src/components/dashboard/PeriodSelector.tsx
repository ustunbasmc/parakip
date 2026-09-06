"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { PERIOD_LABELS, type DashboardPeriod } from "@/lib/format/date";

const OPTIONS: DashboardPeriod[] = ["today", "week", "month", "year"];

/**
 * Dashboard'daki gelir/gider/net değişim için zaman aralığı seçici.
 * Seçim URL'nin ?period= parametresine yazılır (sayfa yenilendiğinde
 * korunur). 2×2 sabit grid — hiçbir genişlikte yatay taşma OLMAZ, ayrıca
 * bir "segmented control" tek satıra sığmayacak kadar dar ekranlarda bile
 * güvenli.
 */
export function PeriodSelector({ active }: { active: DashboardPeriod }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function select(period: DashboardPeriod) {
    const next = new URLSearchParams(searchParams.toString());
    if (period === "month") next.delete("period");
    else next.set("period", period);
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <div role="tablist" aria-label="Zaman aralığı" className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
      {OPTIONS.map((period) => {
        const isActive = period === active;
        return (
          <button
            key={period}
            role="tab"
            aria-selected={isActive}
            onClick={() => select(period)}
            className={`rounded-xl py-2 text-sm font-semibold transition-colors ${
              isActive ? "bg-accent text-text-on-accent" : "bg-surface-muted text-text-secondary"
            }`}
          >
            {PERIOD_LABELS[period]}
          </button>
        );
      })}
    </div>
  );
}
