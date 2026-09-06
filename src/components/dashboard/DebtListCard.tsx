import { formatCentsAsTl } from "@/lib/format/amount";
import { formatDueDateLabel } from "@/lib/format/date";
import type { DebtSummaryRow } from "@/lib/dashboard/queries";
import { CardEmptyState } from "./DashboardCard";

/**
 * "Önceliklendirilmiş" gösterim: liste zaten vade tarihine göre sıralı
 * geliyor (en yakın/en gecikmiş önce, bkz. queries.ts); burada ayrıca
 * gecikmiş kalemler soldaki renkli çizgiyle (danger) GÖRSEL olarak da
 * ayrıştırılıyor — taranarak "hangisi acil?" sorusunun cevabı anında
 * görülsün diye.
 */
export function DebtList({
  debts,
  emptyMessage,
  emptyHint,
}: {
  debts: DebtSummaryRow[];
  emptyMessage: string;
  emptyHint?: string;
}) {
  if (debts.length === 0) {
    return <CardEmptyState message={emptyMessage} hint={emptyHint} />;
  }

  return (
    <ul className="flex flex-col gap-2">
      {debts.map((debt) => {
        const dueLabel = debt.dueDate ? formatDueDateLabel(debt.dueDate) : null;
        const overdue = dueLabel?.includes("gecikti");
        const dueSoon = dueLabel === "Bugün" || dueLabel === "Yarın";

        return (
          <li
            key={debt.debtId}
            className={`flex items-center justify-between gap-3 rounded-xl border-l-[3px] bg-surface-muted/60 py-2.5 pl-3 pr-3.5 ${
              overdue ? "border-l-danger" : dueSoon ? "border-l-warning" : "border-l-border-strong"
            }`}
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-text-primary">{debt.counterpartyName}</p>
              {dueLabel ? (
                <p className={`text-xs ${overdue ? "font-medium text-danger" : "text-text-muted"}`}>
                  {dueLabel}
                </p>
              ) : null}
            </div>
            <p className="whitespace-nowrap text-sm font-semibold tabular-nums text-text-primary">
              {formatCentsAsTl(debt.remainingCents)}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
