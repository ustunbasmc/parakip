import { formatCentsAsCurrency } from "@/lib/format/amount";
import type { CategoryBreakdownRow } from "@/lib/dashboard/reports";

const BAR_COLORS = ["bg-accent", "bg-danger", "bg-warning", "bg-success", "bg-text-muted"];

/** Basit, hafif CSS çubuk grafiği — harici kütüphane gerektirmez. */
export function CategoryBreakdownChart({ rows }: { rows: CategoryBreakdownRow[] }) {
  if (rows.length === 0) return null;
  const max = Math.max(...rows.map((r) => r.totalCents));

  return (
    <div className="flex flex-col gap-3">
      {rows.slice(0, 8).map((row, i) => (
        <div key={row.categoryId ?? "none"} className="flex min-w-0 items-center gap-3">
          <span className="w-24 shrink-0 truncate text-xs text-text-secondary sm:w-32">{row.categoryName}</span>
          <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-muted">
            <div
              className={`h-full rounded-full ${BAR_COLORS[i % BAR_COLORS.length]}`}
              style={{ width: `${max > 0 ? Math.max((row.totalCents / max) * 100, 3) : 0}%` }}
            />
          </div>
          <span className="w-20 shrink-0 text-right text-xs font-semibold tabular-nums text-text-primary sm:w-24">
            {formatCentsAsCurrency(row.totalCents, "TRY")}
          </span>
        </div>
      ))}
    </div>
  );
}
