/**
 * Önceki döneme göre değişim yüzdesi. Önceki dönem 0 ise yüzde
 * HESAPLANAMAZ — sahte bir "%100" yerine hiçbir şey gösterilmez.
 *
 * `goodWhen`: artışın iyi mi kötü mü olduğu (gelirde artış iyi, giderde
 * artış kötü) — renk buna göre seçilir, ok yönü her zaman gerçek yönü
 * gösterir.
 */
export function DeltaBadge({
  current,
  previous,
  goodWhen = "up",
  className,
}: {
  current: number;
  previous: number;
  goodWhen?: "up" | "down";
  className?: string;
}) {
  if (!previous) return null;
  const change = ((current - previous) / Math.abs(previous)) * 100;
  if (!Number.isFinite(change)) return null;

  const rounded = Math.round(change);
  const up = rounded > 0;
  const flat = rounded === 0;
  const good = flat ? null : goodWhen === "up" ? up : !up;
  const tone = good === null ? "bg-surface-muted text-text-muted" : good ? "bg-income-soft text-income" : "bg-expense-soft text-expense";

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${tone} ${className ?? ""}`}
      title="Önceki döneme göre"
    >
      <span aria-hidden="true">{flat ? "→" : up ? "↑" : "↓"}</span>
      <span className="sr-only">Önceki döneme göre </span>%{Math.abs(rounded)}
    </span>
  );
}
