import type { MonthlyTrendRow } from "@/lib/dashboard/reports";

/** Basit, hafif CSS sütun grafiği (gelir/gider) — harici kütüphane gerektirmez. */
export function MonthlyTrendChart({ rows }: { rows: MonthlyTrendRow[] }) {
  const max = Math.max(1, ...rows.map((r) => Math.max(r.incomeCents, r.expenseCents)));
  const hasAnyData = rows.some((r) => r.incomeCents > 0 || r.expenseCents > 0);

  if (!hasAnyData) return null;

  return (
    <div className="flex min-w-0 items-end gap-2 overflow-x-auto pb-1 sm:gap-4">
      {rows.map((row) => (
        <div key={row.monthKey} className="flex shrink-0 flex-col items-center gap-1.5">
          <div className="flex h-28 items-end gap-1 sm:h-36">
            <div
              className="w-2.5 rounded-t-sm bg-success sm:w-3.5"
              style={{ height: `${Math.max((row.incomeCents / max) * 100, row.incomeCents > 0 ? 4 : 0)}%` }}
              title={`Gelir: ${row.incomeCents}`}
            />
            <div
              className="w-2.5 rounded-t-sm bg-danger sm:w-3.5"
              style={{ height: `${Math.max((row.expenseCents / max) * 100, row.expenseCents > 0 ? 4 : 0)}%` }}
              title={`Gider: ${row.expenseCents}`}
            />
          </div>
          <span className="text-[10px] font-medium text-text-muted sm:text-xs">{row.monthLabel}</span>
        </div>
      ))}
    </div>
  );
}
