import Link from "next/link";
import { formatCentsAsCurrency } from "@/lib/format/amount";
import { categoryColor } from "@/lib/format/categoryColor";
import { ProgressBar, type ProgressTone } from "@/components/ui/ProgressBar";
import { PieChartIcon, TagIcon } from "@/components/icons";
import type { BudgetRow } from "@/lib/dashboard/budgets";

const ALERT_TONE: Record<BudgetRow["alertLevel"], ProgressTone> = {
  ok: "accent",
  warning_80: "warning",
  exceeded: "danger",
};

function periodLabel(periodMonth: string) {
  const [y, m] = periodMonth.split("-").map(Number);
  return new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric" }).format(new Date(y, m - 1, 1));
}

/**
 * Bütçe kartı — kategori rengi/ikonu, dönem, kullanılan/tanımlanan tutar,
 * ilerleme çubuğu ve durum rozeti. Değerler budget_usage view'ından
 * gelir; burada hiçbir hesap yeniden yapılmaz (yalnızca "kalan" farkı).
 * `compact`: ana sayfadaki özet listesi için daha sıkı görünüm.
 */
export function BudgetListItem({
  budget,
  spaceParam,
  compact = false,
}: {
  budget: BudgetRow;
  spaceParam: string;
  compact?: boolean;
}) {
  const remaining = budget.budgetCents - budget.usedCents;
  const isTotal = budget.categoryId === null;
  const name = isTotal ? "Toplam bütçe" : budget.categoryName ?? "Kategori";
  const color = isTotal ? "var(--color-accent)" : categoryColor(budget.categoryId);
  const pct = Math.round(budget.percentUsed);

  const status =
    budget.alertLevel === "exceeded"
      ? { text: "Aşıldı", cls: "bg-danger-soft text-danger" }
      : budget.alertLevel === "warning_80"
        ? { text: "Limite yakın", cls: "bg-warning-soft text-warning" }
        : null;

  return (
    <Link
      href={`/budgets/${budget.id}?space=${spaceParam}`}
      className={`flex min-w-0 flex-col transition-colors active:bg-surface-muted ${
        compact ? "gap-2 rounded-2xl px-1 py-1" : "surface-card animate-rise gap-3 rounded-3xl p-4"
      }`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span
          aria-hidden="true"
          className={`flex shrink-0 items-center justify-center rounded-xl ${compact ? "h-8 w-8" : "h-10 w-10"}`}
          style={{ background: `color-mix(in srgb, ${color} 16%, transparent)`, color }}
        >
          {isTotal ? <PieChartIcon size={compact ? 15 : 18} /> : <TagIcon size={compact ? 15 : 18} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-text-primary">{name}</p>
          {!compact || status ? (
            <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
              {status ? (
                <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${status.cls}`}>{status.text}</span>
              ) : null}
              {!compact ? <span className="truncate text-xs capitalize text-text-muted">{periodLabel(budget.periodMonth)}</span> : null}
            </div>
          ) : null}
        </div>
        <span className={`shrink-0 text-xs font-bold tabular-nums ${budget.alertLevel === "exceeded" ? "text-danger" : "text-text-secondary"}`}>
          %{pct}
        </span>
      </div>

      <ProgressBar percent={budget.percentUsed} tone={ALERT_TONE[budget.alertLevel]} label={`${name} kullanım oranı`} size={compact ? "sm" : "md"} />

      <div className="flex min-w-0 items-center justify-between gap-2 text-xs">
        <span className="min-w-0 truncate tabular-nums text-text-secondary">
          <strong className="font-bold text-text-primary">{formatCentsAsCurrency(budget.usedCents, "TRY")}</strong> /{" "}
          {formatCentsAsCurrency(budget.budgetCents, "TRY")}
        </span>
        <span className={`shrink-0 tabular-nums ${remaining >= 0 ? "text-text-muted" : "font-semibold text-danger"}`}>
          {remaining >= 0
            ? `Kalan ${formatCentsAsCurrency(remaining, "TRY")}`
            : `${formatCentsAsCurrency(Math.abs(remaining), "TRY")} aşıldı`}
        </span>
      </div>
    </Link>
  );
}
