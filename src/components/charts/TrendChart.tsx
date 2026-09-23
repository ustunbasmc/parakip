"use client";

import { useState } from "react";
import { formatCentsAsCurrency } from "@/lib/format/amount";

export interface TrendPoint {
  key: string;
  /** Kısa eksen etiketi (ör. "Oca"). */
  label: string;
  /** Tooltip başlığı (ör. "Oca 2026"). */
  fullLabel: string;
  incomeCents: number;
  expenseCents: number;
}

/**
 * Aylık gelir/gider sütunları — CSS tabanlı, sabit genişlikte ızgara
 * (her ay eşit pay alır, hiçbir genişlikte yatay kayma oluşmaz). Bir aya
 * dokunulunca üstte o ayın gelir/gider/net değerleri gösterilir;
 * varsayılan olarak en son ay seçilidir.
 */
export function TrendChart({ points, currency = "TRY" }: { points: TrendPoint[]; currency?: string }) {
  const [selectedKey, setSelectedKey] = useState<string>(points[points.length - 1]?.key ?? "");
  const max = Math.max(1, ...points.map((p) => Math.max(p.incomeCents, p.expenseCents)));
  const hasData = points.some((p) => p.incomeCents > 0 || p.expenseCents > 0);
  if (!hasData) return null;

  const selected = points.find((p) => p.key === selectedKey) ?? points[points.length - 1];
  const net = selected.incomeCents - selected.expenseCents;

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1 rounded-xl bg-surface-muted/60 px-3 py-2" aria-live="polite">
        <span className="text-xs font-bold text-text-primary">{selected.fullLabel}</span>
        <span className="text-xs tabular-nums text-income">+{formatCentsAsCurrency(selected.incomeCents, currency)}</span>
        <span className="text-xs tabular-nums text-expense">−{formatCentsAsCurrency(selected.expenseCents, currency)}</span>
        <span className={`ml-auto text-xs font-bold tabular-nums ${net >= 0 ? "text-income" : "text-expense"}`}>
          Net {net >= 0 ? "+" : "−"}
          {formatCentsAsCurrency(Math.abs(net), currency)}
        </span>
      </div>

      <div
        className="grid h-32 min-w-0 items-end gap-1 sm:h-40 sm:gap-2"
        style={{ gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))` }}
        role="group"
        aria-label="Aylık gelir ve gider grafiği"
      >
        {points.map((p, i) => {
          const isSel = p.key === selected.key;
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => setSelectedKey(p.key)}
              aria-pressed={isSel}
              aria-label={`${p.fullLabel}: gelir ${formatCentsAsCurrency(p.incomeCents, currency)}, gider ${formatCentsAsCurrency(p.expenseCents, currency)}`}
              className={`flex h-full min-w-0 items-end justify-center gap-[3px] rounded-lg px-0.5 pb-0.5 transition-colors ${
                isSel ? "bg-surface-muted" : "hover:bg-surface-muted/50"
              }`}
            >
              <span
                className="animate-grow-y w-full max-w-3 rounded-t-[4px] bg-income"
                style={{
                  height: `${p.incomeCents > 0 ? Math.max((p.incomeCents / max) * 100, 3) : 0}%`,
                  opacity: isSel ? 1 : 0.55,
                  animationDelay: `${i * 40}ms`,
                }}
              />
              <span
                className="animate-grow-y w-full max-w-3 rounded-t-[4px] bg-expense"
                style={{
                  height: `${p.expenseCents > 0 ? Math.max((p.expenseCents / max) * 100, 3) : 0}%`,
                  opacity: isSel ? 1 : 0.55,
                  animationDelay: `${i * 40 + 20}ms`,
                }}
              />
            </button>
          );
        })}
      </div>

      <div className="grid min-w-0 gap-1 sm:gap-2" style={{ gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))` }} aria-hidden="true">
        {points.map((p) => (
          <span
            key={p.key}
            className={`truncate text-center text-[10px] font-medium ${p.key === selected.key ? "text-text-primary" : "text-text-muted"}`}
          >
            {p.label}
          </span>
        ))}
      </div>

      <div className="flex items-center justify-center gap-4 text-[11px] text-text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-income" aria-hidden="true" />
          Gelir
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-expense" aria-hidden="true" />
          Gider
        </span>
      </div>
    </div>
  );
}
