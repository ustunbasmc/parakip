interface ComparisonRow {
  label: string;
  free: string;
  premium: string;
}

/**
 * Ücretsiz vs Premium karşılaştırma tablosu. Satırlar, GERÇEKTEN
 * veritabanı seviyesinde uygulanan farkları yansıtır (bkz. çağıran
 * taraf — plans.ts'teki limit değerleri) — sahte/henüz var olmayan bir
 * "fayda" burada asla listelenmez.
 */
export function PlanComparisonTable({ rows }: { rows: ComparisonRow[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="grid grid-cols-[1fr_auto_auto] gap-2 border-b border-border bg-surface-muted px-4 py-2.5">
        <span className="text-xs font-semibold text-text-muted">Özellik</span>
        <span className="w-16 text-right text-xs font-semibold text-text-muted">Ücretsiz</span>
        <span className="w-16 text-right text-xs font-semibold text-accent">Premium</span>
      </div>
      <div className="flex flex-col divide-y divide-border">
        {rows.map((row) => (
          <div key={row.label} className="grid grid-cols-[1fr_auto_auto] items-center gap-2 px-4 py-2.5">
            <span className="text-sm text-text-primary">{row.label}</span>
            <span className="w-16 text-right text-xs text-text-muted">{row.free}</span>
            <span className="w-16 text-right text-xs font-semibold text-accent">{row.premium}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
