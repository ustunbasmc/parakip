import Link from "next/link";
import { formatCentsAsCurrency } from "@/lib/format/amount";
import { assetTypeLabel } from "@/lib/dashboard/investments";
import type { HoldingRow } from "@/lib/dashboard/investments";

/**
 * "Sahte piyasa değeri gösterme": currentValueCents/unrealizedGainCents
 * NULL ise (gerçekten önbelleklenmiş bir fiyat YOKSA) yalnızca maliyet
 * tabanı gösterilir, ASLA tahmini bir değer üretilmez.
 */
export function HoldingListItem({ holding, spaceParam }: { holding: HoldingRow; spaceParam: string }) {
  const hasPrice = holding.currentValueCents !== null;
  const gain = holding.unrealizedGainCents;

  return (
    <Link
      href={`/investments/${holding.id}?space=${spaceParam}`}
      className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3.5 transition-colors active:bg-surface-muted"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-bold text-accent">
        {holding.assetSymbol.slice(0, 4).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-text-primary">{holding.assetSymbol}</p>
        <p className="truncate text-xs text-text-muted">
          {assetTypeLabel(holding.assetType)} · {holding.quantity} adet
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-bold tabular-nums text-text-primary">
          {formatCentsAsCurrency(hasPrice ? holding.currentValueCents! : holding.totalCostBasisCents, holding.currency)}
        </p>
        {hasPrice && gain !== null ? (
          <p className={`text-xs font-semibold ${gain >= 0 ? "text-success" : "text-danger"}`}>
            {gain >= 0 ? "+" : ""}
            {formatCentsAsCurrency(gain, holding.currency)}
          </p>
        ) : (
          <p className="text-[10px] text-text-muted">Piyasa değeri yok</p>
        )}
      </div>
    </Link>
  );
}
