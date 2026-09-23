import { formatCentsAsCurrency, formatPct, formatShare } from "@/lib/format/amount";
import { assetTypeLabel, type HoldingRow, type PortfolioTotals } from "@/lib/dashboard/investments";
import { CHART_SERIES } from "@/lib/format/categoryColor";
import { TrendingUpIcon } from "@/components/icons";

/**
 * Portföy özeti (hero). Değerler computePortfolioTotals'tan gelir —
 * burada yeni bir finansal hesap yapılmaz. Varlık türü dağılımı, her
 * varlığın güncel değeri (fiyat YOKSA maliyet tabanı — /investments ile
 * aynı kural) üzerinden yalnızca görsel oran olarak gösterilir.
 *
 * Fiyat geçmişi tutulmadığı için bir "trend çizgisi" ÇİZİLMEZ (sahte
 * grafik üretilmez).
 */
export function PortfolioSummaryCard({
  totals,
  currency,
  holdings = [],
}: {
  totals: PortfolioTotals;
  currency: string;
  holdings?: HoldingRow[];
}) {
  const shownValue = totals.hasAnyPrice ? totals.totalCurrentValueCents! : totals.totalCostBasisCents;
  const gain = totals.hasAnyPrice ? totals.totalUnrealizedGainCents! : null;
  const gainPct = gain !== null && totals.totalCostBasisCents > 0 ? (gain / totals.totalCostBasisCents) * 100 : null;

  const byType = new Map<string, number>();
  for (const h of holdings.filter((x) => x.currency === currency)) {
    byType.set(h.assetType, (byType.get(h.assetType) ?? 0) + (h.currentValueCents ?? h.totalCostBasisCents));
  }
  const allocation = Array.from(byType.entries())
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);
  const allocTotal = allocation.reduce((s, [, v]) => s + v, 0);

  return (
    <section
      aria-label="Portföy özeti"
      className="animate-rise relative overflow-hidden rounded-3xl border p-4 sm:p-5"
      style={{
        backgroundImage: "var(--gradient-hero)",
        boxShadow: "var(--shadow-hero)",
        borderColor: "color-mix(in srgb, var(--color-accent) 28%, var(--color-border))",
      }}
    >
      <div className="flex items-center gap-2 text-text-secondary">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-soft text-accent">
          <TrendingUpIcon size={15} />
        </span>
        <p className="text-sm font-semibold">{totals.hasAnyPrice ? "Güncel portföy değeri" : "Maliyet bazlı toplam"}</p>
      </div>

      <div className="mt-2 flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="break-words text-3xl font-extrabold tabular-nums text-text-primary sm:text-4xl">
          {formatCentsAsCurrency(shownValue, currency)}
        </p>
        {gain !== null ? (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ${
              gain >= 0 ? "bg-income-soft text-income" : "bg-expense-soft text-expense"
            }`}
          >
            {gain >= 0 ? "+" : "−"}
            {formatCentsAsCurrency(Math.abs(gain), currency)}
            {gainPct !== null ? ` · %${formatPct(gainPct)}` : ""}
          </span>
        ) : null}
      </div>

      <div className="mt-4 flex flex-col gap-1 rounded-2xl bg-[var(--tile-bg)] px-3 py-2 backdrop-blur-sm sm:grid sm:grid-cols-3 sm:gap-2 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        <Tile label="Maliyet" value={formatCentsAsCurrency(totals.totalCostBasisCents, currency)} />
        <Tile
          label="Gerçekleşmemiş K/Z"
          value={gain === null ? "—" : `${gain >= 0 ? "+" : ""}${formatCentsAsCurrency(gain, currency)}`}
          tone={gain === null ? "muted" : gain >= 0 ? "income" : "expense"}
        />
        <Tile
          label="Gerçekleşmiş K/Z"
          value={`${totals.totalRealizedGainCents >= 0 ? "+" : ""}${formatCentsAsCurrency(totals.totalRealizedGainCents, currency)}`}
          tone={totals.totalRealizedGainCents >= 0 ? "income" : "expense"}
        />
      </div>

      {allocation.length > 0 && allocTotal > 0 ? (
        <div className="mt-4">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-muted">Varlık dağılımı</p>
          <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-surface-muted" aria-hidden="true">
            {allocation.map(([type, v], i) => (
              <div
                key={type}
                className="animate-grow-x h-full"
                style={{ width: `${(v / allocTotal) * 100}%`, background: CHART_SERIES[i % CHART_SERIES.length], animationDelay: `${i * 60}ms` }}
              />
            ))}
          </div>
          <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
            {allocation.map(([type, v], i) => (
              <li key={type} className="flex items-center gap-1.5 text-[11px] text-text-secondary">
                <span className="h-2 w-2 rounded-full" style={{ background: CHART_SERIES[i % CHART_SERIES.length] }} aria-hidden="true" />
                {assetTypeLabel(type)} <span className="font-semibold tabular-nums text-text-muted">{formatShare(v, allocTotal)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {!totals.hasAnyPrice && totals.holdingCount > 0 ? (
        <p className="mt-3 text-xs text-text-muted">
          Hiçbir varlığın güncel piyasa fiyatı henüz mevcut değil — yalnızca maliyet bazlı tutar gösteriliyor.
        </p>
      ) : null}
    </section>
  );
}

function Tile({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "income" | "expense" | "muted" }) {
  const cls = tone === "income" ? "text-income" : tone === "expense" ? "text-expense" : tone === "muted" ? "text-text-muted" : "text-text-primary";
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-2 sm:flex-col sm:items-start sm:gap-0 sm:rounded-2xl sm:bg-[var(--tile-bg)] sm:p-2.5 sm:backdrop-blur-sm">
      <p className="truncate text-[11px] font-semibold text-text-muted sm:text-[10px]">{label}</p>
      <p className={`shrink-0 whitespace-nowrap text-sm font-extrabold tabular-nums sm:max-w-full sm:truncate ${cls}`}>{value}</p>
    </div>
  );
}
