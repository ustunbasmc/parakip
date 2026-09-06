import Link from "next/link";
import { formatCentsAsTl } from "@/lib/format/amount";
import type { BudgetSummary } from "@/lib/dashboard/queries";
import { CardEmptyState } from "./DashboardCard";

const ALERT_BAR_CLASS: Record<BudgetSummary["alertLevel"], string> = {
  ok: "bg-accent",
  warning_80: "bg-warning",
  exceeded: "bg-danger",
};

export function BudgetProgress({ summary, spaceParam }: { summary: BudgetSummary | null; spaceParam?: string }) {
  if (!summary) {
    return (
      <CardEmptyState
        message="Bu ay için bütçe belirlenmedi."
        hint={spaceParam ? undefined : "Bütçeler ekranından ilk bütçeni oluşturabilirsin."}
      />
    );
  }

  const remaining = summary.budgetCents - summary.usedCents;
  const barWidth = Math.min(100, summary.percentUsed);
  const isExceeded = summary.alertLevel === "exceeded";

  return (
    <div className="flex min-w-0 flex-col gap-2.5">
      <div className="flex min-w-0 items-baseline justify-between gap-2">
        <p className="min-w-0 truncate text-xl font-bold tabular-nums text-text-primary">
          {formatCentsAsTl(summary.usedCents)}
        </p>
        <p className="shrink-0 text-sm text-text-muted">/ {formatCentsAsTl(summary.budgetCents)}</p>
      </div>
      <div
        className="h-2.5 w-full overflow-hidden rounded-full bg-surface-muted"
        role="progressbar"
        aria-valuenow={Math.round(summary.percentUsed)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Bütçe kullanım oranı"
      >
        <div
          className={`h-full rounded-full transition-[width] ${ALERT_BAR_CLASS[summary.alertLevel]}`}
          style={{ width: `${barWidth}%` }}
        />
      </div>

      {isExceeded ? (
        <div className="flex min-w-0 items-center gap-1.5 rounded-xl bg-danger-soft px-2.5 py-1.5">
          <span className="shrink-0 text-xs font-bold text-danger">Bütçe aşıldı</span>
          <span className="min-w-0 truncate text-xs text-danger">— {formatCentsAsTl(Math.abs(remaining))} fazla harcandı</span>
        </div>
      ) : (
        <p className="truncate text-xs text-text-muted">
          Kalan: {formatCentsAsTl(remaining)} · %{Math.round(summary.percentUsed)} kullanıldı
        </p>
      )}

      {spaceParam ? (
        <Link href={`/budgets?space=${spaceParam}`} className="text-xs font-semibold text-accent">
          Bütçeleri gör
        </Link>
      ) : null}
    </div>
  );
}
