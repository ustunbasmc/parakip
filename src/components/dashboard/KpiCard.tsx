import type { ReactNode } from "react";

export type KpiTone = "income" | "expense" | "balance" | "muted";

const TONE: Record<KpiTone, { icon: string; value: string; glow: string }> = {
  income: { icon: "bg-income-soft text-income", value: "text-income", glow: "var(--color-income)" },
  expense: { icon: "bg-expense-soft text-expense", value: "text-expense", glow: "var(--color-expense)" },
  balance: { icon: "bg-balance-soft text-balance", value: "text-text-primary", glow: "var(--color-balance)" },
  muted: { icon: "bg-surface-muted text-text-muted", value: "text-text-muted", glow: "transparent" },
};

/**
 * Gelir / gider / net durum gibi tek bir göstergenin kartı. Rakam büyük
 * ve okunaklı; renk finansal anlamı taşır (gelir turkuaz, gider pembe).
 * Köşedeki çok hafif renkli ışık yönü destekler, metnin arkasına düşmez.
 */
export function KpiCard({
  label,
  value,
  icon,
  tone,
  badge,
  footnote,
  className,
  delay = 0,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  tone: KpiTone;
  /** Ör. önceki döneme göre değişim rozeti. */
  badge?: ReactNode;
  /** Kartın altında küçük açıklama (ör. "Gelirinin %66'sı"). */
  footnote?: ReactNode;
  className?: string;
  delay?: number;
}) {
  const t = TONE[tone];
  return (
    <div
      className={`surface-card animate-rise relative min-w-0 overflow-hidden rounded-3xl p-4 transition-transform duration-150 hover:-translate-y-0.5 sm:p-5 ${className ?? ""}`}
      style={delay ? { animationDelay: `${delay}ms` } : undefined}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-[0.14] blur-2xl"
        style={{ background: t.glow }}
      />
      <div className="relative flex min-w-0 items-center gap-2">
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${t.icon}`} aria-hidden="true">
          {icon}
        </span>
        <span className="truncate text-sm font-semibold text-text-secondary">{label}</span>
      </div>
      <p
        className={`relative mt-3 text-[clamp(1.2rem,5.2vw,1.75rem)] font-extrabold leading-tight tracking-tight tabular-nums [overflow-wrap:anywhere] ${t.value}`}
      >
        {value}
      </p>
      {/* Rozet ve açıklama tutarın ALTINDA — dar kartlarda etiketi kesmesin. */}
      {badge || footnote ? (
        <div className="relative mt-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-muted">
          {badge}
          {footnote ? <span className="min-w-0">{footnote}</span> : null}
        </div>
      ) : null}
    </div>
  );
}
