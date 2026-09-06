import Link from "next/link";
import { formatCentsAsCurrency } from "@/lib/format/amount";
import type { BudgetRow } from "@/lib/dashboard/budgets";

const ALERT_BAR: Record<BudgetRow["alertLevel"], string> = {
  ok: "bg-accent",
  warning_80: "bg-warning",
  exceeded: "bg-danger",
};

export function BudgetListItem({ budget, spaceParam }: { budget: BudgetRow; spaceParam: string }) {
  const barWidth = Math.min(100, budget.percentUsed);
  const remaining = budget.budgetCents - budget.usedCents;

  return (
    <Link
      href={`/budgets/${budget.id}?space=${spaceParam}`}
      className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-4 transition-colors active:bg-surface-muted"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-sm font-semibold text-text-primary">
          {budget.categoryId === null ? "Toplam bütçe" : budget.categoryName}
        </p>
        <p className="shrink-0 text-xs text-text-muted">%{Math.round(budget.percentUsed)}</p>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
        <div className={`h-full rounded-full ${ALERT_BAR[budget.alertLevel]}`} style={{ width: `${barWidth}%` }} />
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-text-secondary">
          {formatCentsAsCurrency(budget.usedCents, "TRY")} / {formatCentsAsCurrency(budget.budgetCents, "TRY")}
        </span>
        <span className={remaining >= 0 ? "text-text-muted" : "font-semibold text-danger"}>
          {remaining >= 0 ? `Kalan ${formatCentsAsCurrency(remaining, "TRY")}` : `${formatCentsAsCurrency(Math.abs(remaining), "TRY")} aşıldı`}
        </span>
      </div>
    </Link>
  );
}
