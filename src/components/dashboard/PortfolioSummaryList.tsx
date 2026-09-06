import { formatCentsAsCurrency } from "@/lib/format/amount";
import type { PortfolioSummaryRow } from "@/lib/dashboard/queries";
import { CardEmptyState } from "./DashboardCard";

export function PortfolioSummaryList({ rows }: { rows: PortfolioSummaryRow[] }) {
  if (rows.length === 0) {
    return (
      <CardEmptyState
        message="Henüz yatırımın yok."
        hint="Yatırım ekleme yakında eklenecek."
      />
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-border">
      {rows.map((row) => (
        <li key={row.currency} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
          <div>
            <p className="text-sm font-medium text-text-primary">
              {row.holdingCount} varlık · {row.currency}
            </p>
            {row.realizedGainCents !== 0 ? (
              <p className={`text-xs ${row.realizedGainCents > 0 ? "text-success" : "text-danger"}`}>
                Gerçekleşmiş: {row.realizedGainCents > 0 ? "+" : ""}
                {formatCentsAsCurrency(row.realizedGainCents, row.currency)}
              </p>
            ) : null}
          </div>
          <p className="text-sm font-semibold tabular-nums text-text-primary">
            {formatCentsAsCurrency(row.totalCostBasisCents, row.currency)}
          </p>
        </li>
      ))}
    </ul>
  );
}
