import { ArrowUpRightIcon, ArrowDownRightIcon } from "@/components/icons";
import { formatCentsAsCurrency } from "@/lib/format/amount";
import { PERIOD_LABELS, type DashboardPeriod } from "@/lib/format/date";
import type { CurrencyAmount } from "@/lib/dashboard/queries";

interface Props {
  income: CurrencyAmount[];
  expense: CurrencyAmount[];
  period?: DashboardPeriod;
}

function mergeCurrencies(income: CurrencyAmount[], expense: CurrencyAmount[]): string[] {
  const set = new Set([...income.map((i) => i.currency), ...expense.map((e) => e.currency)]);
  if (set.size === 0) set.add("TRY");
  return Array.from(set);
}

/** Seçilen zaman aralığındaki gelir / gider / net değişim — tek karta gruplanmış üç bölüm. */
export function MonthSummaryRow({ income, expense, period = "month" }: Props) {
  const currencies = mergeCurrencies(income, expense);

  return (
    <section className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
      <h2 className="mb-3.5 text-sm font-semibold text-text-secondary">{PERIOD_LABELS[period]}</h2>
      <div className="flex flex-col gap-4">
        {currencies.map((currency) => {
          const incomeCents = income.find((i) => i.currency === currency)?.cents ?? 0;
          const expenseCents = expense.find((e) => e.currency === currency)?.cents ?? 0;
          const net = incomeCents - expenseCents;

          return (
            <div key={currency} className="grid grid-cols-3 gap-2">
              <div className="flex flex-col gap-1">
                <span className="flex items-center gap-1 text-xs font-medium text-text-muted">
                  <ArrowUpRightIcon size={14} className="text-success" />
                  Gelir
                </span>
                <span className="truncate text-base font-bold tabular-nums text-text-primary">
                  {formatCentsAsCurrency(incomeCents, currency)}
                </span>
              </div>

              <div className="flex flex-col gap-1 border-x border-border px-2">
                <span className="flex items-center gap-1 text-xs font-medium text-text-muted">
                  <ArrowDownRightIcon size={14} className="text-danger" />
                  Gider
                </span>
                <span className="truncate text-base font-bold tabular-nums text-text-primary">
                  {formatCentsAsCurrency(expenseCents, currency)}
                </span>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-text-muted">Net değişim</span>
                <span
                  className={`truncate text-base font-bold tabular-nums ${
                    net >= 0 ? "text-success" : "text-danger"
                  }`}
                >
                  {net >= 0 ? "+" : ""}
                  {formatCentsAsCurrency(net, currency)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
