import Link from "next/link";
import { formatCentsAsTl } from "@/lib/format/amount";
import { formatDueDateLabel } from "@/lib/format/date";
import type { DebtSummaryRow } from "@/lib/dashboard/queries";
import { CardEmptyState } from "./DashboardCard";
import { ClockIcon } from "@/components/icons";

/**
 * Yaklaşan borç/alacak listesi. Liste zaten vade tarihine göre sıralı
 * geliyor (bkz. queries.ts); gecikmiş kalemler kırmızı, bugün/yarın
 * olanlar amber rozetle ayrışır. Yön rengi: borç (ödenecek) pembe/
 * kırmızı, alacak (tahsil edilecek) turkuaz.
 */
export function DebtList({
  debts,
  emptyMessage,
  emptyHint,
  spaceParam,
  emptyAction,
}: {
  debts: DebtSummaryRow[];
  emptyMessage: string;
  emptyHint?: string;
  /** Verilirse her satır ilgili borç detayına bağlanır. */
  spaceParam?: string;
  emptyAction?: { href: string; label: string };
}) {
  if (debts.length === 0) {
    return <CardEmptyState message={emptyMessage} hint={emptyHint} action={emptyAction} icon={<ClockIcon size={20} />} />;
  }

  return (
    <ul className="flex min-w-0 flex-col gap-2">
      {debts.map((debt) => {
        const dueLabel = debt.dueDate ? formatDueDateLabel(debt.dueDate) : null;
        const overdue = dueLabel?.includes("gecikti");
        const dueSoon = dueLabel === "Bugün" || dueLabel === "Yarın";
        const payable = debt.direction === "payable";

        const content = (
          <>
            <span
              aria-hidden="true"
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-black ${
                payable ? "bg-expense-soft text-expense" : "bg-income-soft text-income"
              }`}
            >
              {payable ? "−" : "+"}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-text-primary">{debt.counterpartyName}</p>
              <p className="truncate text-xs text-text-muted">{payable ? "Ödenecek" : "Tahsil edilecek"}</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <p className={`whitespace-nowrap text-sm font-bold tabular-nums ${payable ? "text-expense" : "text-income"}`}>
                {formatCentsAsTl(debt.remainingCents)}
              </p>
              {dueLabel ? (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    overdue ? "bg-danger-soft text-danger" : dueSoon ? "bg-warning-soft text-warning" : "bg-surface-muted text-text-muted"
                  }`}
                >
                  {dueLabel}
                </span>
              ) : null}
            </div>
          </>
        );

        const cls = "flex min-w-0 items-center gap-3 rounded-2xl bg-surface-muted/50 p-2.5 transition-colors";
        return (
          <li key={debt.debtId}>
            {spaceParam ? (
              <Link href={`/debts/${debt.debtId}?space=${spaceParam}`} className={`${cls} hover:bg-surface-muted active:bg-surface-muted`}>
                {content}
              </Link>
            ) : (
              <div className={cls}>{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
