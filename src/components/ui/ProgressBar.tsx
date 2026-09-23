export type ProgressTone = "accent" | "income" | "expense" | "balance" | "warning" | "danger" | "muted";

const TONE_CLASS: Record<ProgressTone, string> = {
  accent: "bg-accent",
  income: "bg-income",
  expense: "bg-expense",
  balance: "bg-balance",
  warning: "bg-warning",
  danger: "bg-danger",
  muted: "bg-text-muted",
};

/**
 * Ortak ilerleme çubuğu — bütçe kullanımı, borç ödeme oranı vb. Değer
 * 0-100 aralığına kırpılır (aşım durumunu çağıran taraf ayrıca metinle
 * gösterir). Genişlik değişimi yumuşak geçişle animasyonlanır.
 */
export function ProgressBar({
  percent,
  tone = "accent",
  label,
  size = "md",
}: {
  percent: number;
  tone?: ProgressTone;
  /** Ekran okuyucular için (ör. "Bütçe kullanım oranı"). */
  label: string;
  size?: "sm" | "md";
}) {
  const clamped = Math.max(0, Math.min(100, Number.isFinite(percent) ? percent : 0));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={`w-full overflow-hidden rounded-full bg-surface-muted ${size === "sm" ? "h-1.5" : "h-2.5"}`}
    >
      <div
        className={`h-full rounded-full transition-[width] duration-500 ease-out ${TONE_CLASS[tone]}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
