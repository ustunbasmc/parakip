import { formatCentsAsCurrency } from "@/lib/format/amount";
import type { PortfolioTotals } from "@/lib/dashboard/investments";

export function PortfolioSummaryCard({ totals, currency }: { totals: PortfolioTotals; currency: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <p className="text-xs text-text-muted">
        {totals.hasAnyPrice ? "Güncel portföy değeri (kısmi)" : "Maliyet bazlı toplam"}
      </p>
      <p className="mt-1 text-3xl font-extrabold tabular-nums text-text-primary">
        {formatCentsAsCurrency(totals.hasAnyPrice ? totals.totalCurrentValueCents! : totals.totalCostBasisCents, currency)}
      </p>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <div>
          <p className="text-[10px] text-text-muted">Maliyet</p>
          <p className="truncate text-sm font-semibold text-text-primary">
            {formatCentsAsCurrency(totals.totalCostBasisCents, currency)}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-text-muted">Gerçekleşmemiş K/Z</p>
          {totals.hasAnyPrice ? (
            <p className={`truncate text-sm font-semibold ${totals.totalUnrealizedGainCents! >= 0 ? "text-success" : "text-danger"}`}>
              {totals.totalUnrealizedGainCents! >= 0 ? "+" : ""}
              {formatCentsAsCurrency(totals.totalUnrealizedGainCents!, currency)}
            </p>
          ) : (
            <p className="text-sm text-text-muted">—</p>
          )}
        </div>
        <div>
          <p className="text-[10px] text-text-muted">Gerçekleşmiş K/Z</p>
          <p className={`truncate text-sm font-semibold ${totals.totalRealizedGainCents >= 0 ? "text-success" : "text-danger"}`}>
            {totals.totalRealizedGainCents >= 0 ? "+" : ""}
            {formatCentsAsCurrency(totals.totalRealizedGainCents, currency)}
          </p>
        </div>
      </div>

      {!totals.hasAnyPrice && totals.holdingCount > 0 ? (
        <p className="mt-3 text-xs text-text-muted">
          Hiçbir varlığın güncel piyasa fiyatı henüz mevcut değil — yalnızca maliyet bazlı tutar gösteriliyor.
        </p>
      ) : null}
    </div>
  );
}
