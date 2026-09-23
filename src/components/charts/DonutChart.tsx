"use client";

import { useState } from "react";
import { formatCentsAsCurrency, formatShare } from "@/lib/format/amount";

export interface DonutSegment {
  key: string;
  label: string;
  valueCents: number;
  color: string;
}

/**
 * Hafif SVG halka grafik (harici kütüphane yok). Bir dilime veya
 * açıklamadaki satıra dokunulunca ortada o dilimin tutarı ve payı
 * gösterilir; tekrar dokununca toplama döner. Klavye ile de seçilebilir.
 */
export function DonutChart({
  segments,
  currency = "TRY",
  centerLabel = "Toplam",
}: {
  segments: DonutSegment[];
  currency?: string;
  centerLabel?: string;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const total = segments.reduce((s, x) => s + x.valueCents, 0);
  if (total <= 0) return null;

  const size = 132;
  const stroke = 16;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const gap = segments.length > 1 ? 2 : 0;

  // Her dilimin başlangıç noktası = önceki dilimlerin toplam uzunluğu.
  const lengths = segments.map((s) => (s.valueCents / total) * c);
  const arcs = segments.map((s, i) => ({
    ...s,
    dash: Math.max(lengths[i] - gap, 0.5),
    offset: lengths.slice(0, i).reduce((sum, l) => sum + l, 0),
  }));

  const active = selected ? segments.find((s) => s.key === selected) ?? null : null;
  const shownCents = active ? active.valueCents : total;

  return (
    <div className="@container min-w-0">
    <div className="flex min-w-0 flex-col items-center gap-4 @md:flex-row @md:items-center @md:gap-5">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" role="img" aria-label="Kategori dağılımı grafiği">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-surface-muted)" strokeWidth={stroke} />
          {arcs.map((a) => (
            <circle
              key={a.key}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={a.color}
              strokeWidth={selected === a.key ? stroke + 3 : stroke}
              strokeDasharray={`${a.dash} ${c - a.dash}`}
              strokeDashoffset={-a.offset}
              className="animate-ring cursor-pointer transition-[stroke-width,opacity] duration-200"
              style={{ ["--ring-length" as string]: `${a.dash}`, opacity: selected && selected !== a.key ? 0.35 : 1 }}
              onClick={() => setSelected((cur) => (cur === a.key ? null : a.key))}
            />
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-3 text-center">
          <span className="max-w-full truncate text-[10px] font-semibold uppercase tracking-wide text-text-muted">
            {active ? active.label : centerLabel}
          </span>
          <span className="max-w-full truncate text-sm font-extrabold tabular-nums text-text-primary">
            {formatCentsAsCurrency(shownCents, currency)}
          </span>
          {active ? (
            <span className="text-[10px] font-semibold text-text-muted">{formatShare(active.valueCents, total)}</span>
          ) : null}
        </div>
      </div>

      <ul className="flex w-full min-w-0 flex-col gap-1">
        {segments.map((s) => {
          const pct = formatShare(s.valueCents, total);
          const isSel = selected === s.key;
          return (
            <li key={s.key}>
              <button
                type="button"
                onClick={() => setSelected((cur) => (cur === s.key ? null : s.key))}
                aria-pressed={isSel}
                className={`flex w-full min-w-0 items-center gap-2 rounded-xl px-2 py-1.5 text-left transition-colors ${
                  isSel ? "bg-surface-muted" : "hover:bg-surface-muted/60"
                }`}
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-xs text-text-secondary">{s.label}</span>
                <span className="shrink-0 text-[11px] font-semibold tabular-nums text-text-muted">{pct}</span>
                <span className="w-[5.5rem] shrink-0 text-right text-xs font-semibold tabular-nums text-text-primary">
                  {formatCentsAsCurrency(s.valueCents, currency)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
    </div>
  );
}
