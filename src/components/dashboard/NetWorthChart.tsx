"use client";

import { useState } from "react";
import { formatCentsAsCurrency } from "@/lib/format/amount";
import type { NetWorthPoint } from "@/lib/dashboard/netWorth";

const RANGES = [
  { key: 30, label: "30G" },
  { key: 90, label: "90G" },
  { key: 180, label: "6A" },
] as const;

const dayFmt = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", timeZone: "UTC" });
function dayLabel(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return dayFmt.format(new Date(Date.UTC(y, m - 1, d)));
}

/**
 * Net değer geçmişi — YALNIZCA günlük cron'un kaydettiği gerçek anlık
 * görüntülerden çizilir (net_worth_snapshots, migration 0068). İki günden
 * az kayıt varsa grafik çizilmez, nedeni dürüstçe söylenir.
 */
export function NetWorthChart({ points }: { points: NetWorthPoint[] }) {
  const [range, setRange] = useState<number>(90);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (points.length < 2) {
    return (
      <p className="rounded-2xl bg-surface-muted/60 px-4 py-3 text-xs text-text-muted">
        Net değerin her gün otomatik olarak kaydediliyor. Değişim grafiği en az iki günlük kayıt oluştuğunda burada görünecek.
      </p>
    );
  }

  const last = points[points.length - 1].date;
  const [ly, lm, ld] = last.split("-").map(Number);
  const since = new Date(Date.UTC(ly, lm - 1, ld - range)).toISOString().slice(0, 10);
  const visible = points.filter((p) => p.date > since);
  const data = visible.length >= 2 ? visible : points.slice(-2);

  const values = data.map((p) => p.netCents);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = Math.max((max - min) * 0.12, Math.abs(max) * 0.01, 1);
  const lo = min - pad;
  const hi = max + pad;
  const W = 300;
  const H = 100;
  const x = (i: number) => (i / (data.length - 1)) * W;
  const y = (v: number) => H - ((v - lo) / (hi - lo)) * H;
  const line = data.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(2)},${y(p.netCents).toFixed(2)}`).join(" ");
  const area = `${line} L${W},${H} L0,${H} Z`;

  const first = data[0];
  const sel = data[hoverIdx ?? data.length - 1];
  const change = sel.netCents - first.netCents;
  const tone = change >= 0 ? "text-income" : "text-expense";

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <div className="min-w-0" aria-live="polite">
          <p className="text-xs text-text-muted">{dayLabel(sel.date)}</p>
          <p className="text-lg font-extrabold tabular-nums text-text-primary">{formatCentsAsCurrency(sel.netCents, "TRY")}</p>
          <p className={`text-xs font-bold tabular-nums ${tone}`}>
            {change >= 0 ? "+" : "−"}
            {formatCentsAsCurrency(Math.abs(change), "TRY")} · {dayLabel(first.date)} tarihinden beri
          </p>
        </div>
        <div className="flex shrink-0 rounded-full bg-surface-muted p-0.5" role="group" aria-label="Zaman aralığı">
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => {
                setRange(r.key);
                setHoverIdx(null);
              }}
              aria-pressed={range === r.key}
              className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors ${
                range === r.key ? "bg-surface text-text-primary shadow-sm" : "text-text-muted"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative h-36 w-full min-w-0 sm:h-44">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full overflow-visible"
          role="img"
          aria-label={`Net değer grafiği, ${dayLabel(first.date)} – ${dayLabel(data[data.length - 1].date)}`}
          onPointerLeave={() => setHoverIdx(null)}
          onPointerMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const ratio = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
            setHoverIdx(Math.round(ratio * (data.length - 1)));
          }}
        >
          <defs>
            <linearGradient id="nwc-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.28" />
              <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill="url(#nwc-fill)" />
          <path
            d={line}
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth="2.2"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          {hoverIdx !== null ? (
            <line x1={x(hoverIdx)} x2={x(hoverIdx)} y1={0} y2={H} stroke="var(--color-border-strong)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          ) : null}
        </svg>
      </div>

      <div className="flex items-center justify-between gap-2 text-[11px] text-text-muted">
        <span>{dayLabel(first.date)}</span>
        <span>{dayLabel(data[data.length - 1].date)}</span>
      </div>
    </div>
  );
}
