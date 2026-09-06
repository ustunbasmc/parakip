import { formatCentsAsCurrency } from "@/lib/format/amount";
import { formatDueDateLabel } from "@/lib/format/date";
import type { CashFlowSummary } from "@/lib/dashboard/debts";

/**
 * Nakit akışı özeti: toplam açık borç, toplam açık alacak, net pozisyon,
 * vadesi geçmiş ve önümüzdeki 30 gün içindeki kalemler. debt_balances
 * view'ından türetilir — ayrı bir hesaplama/ledger mantığı YOKTUR.
 */
export function CashFlowSummaryCard({ summary }: { summary: CashFlowSummary }) {
  const { totalPayableRemainingCents, totalReceivableRemainingCents, netCents, overdue, upcoming } = summary;

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <p className="mb-3 text-sm font-semibold text-text-secondary">Nakit akışı</p>

      <div className="grid grid-cols-3 gap-2">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-text-muted">Borçlar</span>
          <span className="truncate text-base font-bold tabular-nums text-danger">
            {formatCentsAsCurrency(totalPayableRemainingCents, "TRY")}
          </span>
        </div>
        <div className="flex flex-col gap-1 border-x border-border px-2">
          <span className="text-xs text-text-muted">Alacaklar</span>
          <span className="truncate text-base font-bold tabular-nums text-success">
            {formatCentsAsCurrency(totalReceivableRemainingCents, "TRY")}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-text-muted">Net</span>
          <span className={`truncate text-base font-bold tabular-nums ${netCents >= 0 ? "text-success" : "text-danger"}`}>
            {netCents >= 0 ? "+" : ""}
            {formatCentsAsCurrency(netCents, "TRY")}
          </span>
        </div>
      </div>

      {overdue.length > 0 ? (
        <div className="mt-3.5 rounded-xl bg-danger-soft p-2.5">
          <p className="text-xs font-semibold text-danger">
            {overdue.length} vadesi geçmiş kayıt: {overdue.slice(0, 2).map((d) => d.counterpartyName).join(", ")}
            {overdue.length > 2 ? "…" : ""}
          </p>
        </div>
      ) : null}

      {upcoming.length > 0 ? (
        <div className="mt-2">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-text-muted">Önümüzdeki 30 gün</p>
          <div className="flex flex-col gap-1">
            {upcoming.slice(0, 3).map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-2 text-xs">
                <span className="min-w-0 truncate text-text-secondary">
                  {d.counterpartyName} · {formatDueDateLabel(d.dueDate!)}
                </span>
                <span className={`shrink-0 font-semibold tabular-nums ${d.direction === "payable" ? "text-danger" : "text-success"}`}>
                  {formatCentsAsCurrency(d.remainingCents, "TRY")}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
