import { formatCentsAsCurrency } from "@/lib/format/amount";

/**
 * Seçili dönemde gelir ve giderin yan yana karşılaştırması — iki yatay
 * çubuk, büyük olan tam genişlik. Harcanan oran (gider/gelir) altta
 * metinle verilir; gelir 0 ise oran hesaplanmaz.
 */
export function FlowCompare({
  incomeCents,
  expenseCents,
  currency = "TRY",
}: {
  incomeCents: number;
  expenseCents: number;
  currency?: string;
}) {
  const max = Math.max(incomeCents, expenseCents, 1);
  const rows = [
    { key: "income", label: "Gelir", cents: incomeCents, bar: "bg-income", text: "text-income" },
    { key: "expense", label: "Gider", cents: expenseCents, bar: "bg-expense", text: "text-expense" },
  ];
  const spentRatio = incomeCents > 0 ? Math.round((expenseCents / incomeCents) * 100) : null;

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {rows.map((r, i) => (
        <div key={r.key} className="flex min-w-0 flex-col gap-1.5">
          <div className="flex min-w-0 items-baseline justify-between gap-2">
            <span className="text-xs font-semibold text-text-secondary">{r.label}</span>
            <span className={`truncate text-sm font-bold tabular-nums ${r.text}`}>{formatCentsAsCurrency(r.cents, currency)}</span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-surface-muted">
            <div
              className={`animate-grow-x h-full rounded-full ${r.bar}`}
              style={{ width: `${r.cents > 0 ? Math.max((r.cents / max) * 100, 2) : 0}%`, animationDelay: `${i * 80}ms` }}
            />
          </div>
        </div>
      ))}
      {spentRatio !== null ? (
        <p className="text-xs text-text-muted">
          Gelirinin <strong className={spentRatio > 100 ? "text-expense" : "text-text-primary"}>%{spentRatio}</strong>&apos;ini harcadın.
        </p>
      ) : null}
    </div>
  );
}
