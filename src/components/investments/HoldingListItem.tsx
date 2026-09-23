import Link from "next/link";
import { formatCentsAsCurrency, formatPct } from "@/lib/format/amount";
import { assetTypeLabel } from "@/lib/dashboard/investments";
import type { HoldingRow } from "@/lib/dashboard/investments";

/**
 * Varlık kartı. "Sahte piyasa değeri gösterme": currentValueCents/
 * unrealizedGainCents NULL ise (gerçekten önbelleklenmiş bir fiyat
 * YOKSA) yalnızca maliyet tabanı gösterilir, ASLA tahmini bir değer
 * üretilmez. K/Z yüzdesi yalnızca gerçek fiyat varsa hesaplanır.
 */
export function HoldingListItem({ holding, spaceParam }: { holding: HoldingRow; spaceParam: string }) {
  const hasPrice = holding.currentValueCents !== null;
  const gain = holding.unrealizedGainCents;
  const gainPct = hasPrice && gain !== null && holding.totalCostBasisCents > 0 ? (gain / holding.totalCostBasisCents) * 100 : null;

  return (
    <Link
      href={`/investments/${holding.id}?space=${spaceParam}`}
      className="surface-card animate-rise flex min-w-0 items-center gap-3 rounded-2xl p-3.5 transition-colors active:bg-surface-muted"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-balance-soft text-[11px] font-black tracking-tight text-balance">
        {holding.assetSymbol.slice(0, 4).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-text-primary">{holding.assetSymbol}</p>
        <p className="truncate text-xs text-text-muted">
          {assetTypeLabel(holding.assetType)} · {holding.quantity} adet
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <p className="text-sm font-bold tabular-nums text-text-primary">
          {formatCentsAsCurrency(hasPrice ? holding.currentValueCents! : holding.totalCostBasisCents, holding.currency)}
        </p>
        {hasPrice && gain !== null ? (
          <span
            className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
              gain >= 0 ? "bg-income-soft text-income" : "bg-expense-soft text-expense"
            }`}
          >
            {gain >= 0 ? "▲" : "▼"} {formatCentsAsCurrency(Math.abs(gain), holding.currency)}
            {gainPct !== null ? ` · %${formatPct(gainPct)}` : ""}
          </span>
        ) : (
          <span className="rounded-full bg-surface-muted px-1.5 py-0.5 text-[10px] font-semibold text-text-muted">Piyasa değeri yok</span>
        )}
      </div>
    </Link>
  );
}
