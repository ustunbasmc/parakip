import Link from "next/link";
import { formatCentsAsCurrency } from "@/lib/format/amount";
import type { MonthSummary } from "@/lib/dashboard/monthSummary";
import { SparkleIcon } from "@/components/icons";

/**
 * "Bu ayın özeti" — birkaç kısa, anlaşılır cümle. Tüm rakamlar mevcut
 * gelir/gider kayıtlarından hesaplanır (bkz. lib/dashboard/monthSummary.ts);
 * tahmin cümlesi açıkça "bu hızla" diye belirtilir.
 */
export function MonthSummaryCard({ summary, monthLabel, spaceId }: { summary: MonthSummary; monthLabel: string; spaceId: string }) {
  const s = summary;
  const fmt = (c: number) => formatCentsAsCurrency(c, "TRY");
  const lines: { text: React.ReactNode; tone?: "good" | "bad" }[] = [];

  if (s.expenseChangePct !== null) {
    const less = s.expenseChangePct <= 0;
    lines.push({
      tone: less ? "good" : "bad",
      text: (
        <>
          Geçen ayın aynı dönemine göre <strong>%{Math.abs(s.expenseChangePct)} {less ? "daha az" : "daha fazla"}</strong> harcadın (
          {fmt(s.expenseCents)} / {fmt(s.prevExpenseCents)}).
        </>
      ),
    });
  } else if (s.expenseCents > 0) {
    lines.push({ text: <>Bu ay şu ana kadar <strong>{fmt(s.expenseCents)}</strong> harcadın.</> });
  }
  if (s.topCategory) {
    lines.push({
      text: (
        <>
          En çok <strong>{s.topCategory.name}</strong> için harcadın ({fmt(s.topCategory.cents)}).
        </>
      ),
    });
  }
  if (s.biggestIncrease && s.biggestIncrease.name !== s.topCategory?.name) {
    lines.push({
      tone: "bad",
      text: (
        <>
          <strong>{s.biggestIncrease.name}</strong> harcaman geçen aya göre {fmt(s.biggestIncrease.deltaCents)} arttı.
        </>
      ),
    });
  }
  if (s.expenseCents > 0 && s.daysElapsed >= 5 && s.daysElapsed < s.daysInMonth) {
    lines.push({
      text: (
        <>
          Günde ortalama {fmt(s.dailyAvgCents)} harcıyorsun; bu hızla ay sonunda yaklaşık <strong>{fmt(s.projectedExpenseCents)}</strong> olur.
        </>
      ),
    });
  }
  if (s.savingsRatePct !== null) {
    lines.push({
      tone: s.savingsRatePct >= 0 ? "good" : "bad",
      text:
        s.savingsRatePct >= 0 ? (
          <>
            Bu ayki tasarruf oranın şu an <strong>%{s.savingsRatePct}</strong>.
          </>
        ) : (
          <>
            Bu ay gelirinden <strong>{fmt(s.expenseCents - s.incomeCents)}</strong> fazla harcadın.
          </>
        ),
    });
  }

  if (lines.length === 0) return null;

  return (
    <section className="surface-card animate-rise min-w-0 rounded-3xl p-4 sm:p-5" aria-label="Bu ayın özeti">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent-soft text-accent">
            <SparkleIcon size={16} />
          </span>
          <div>
            <h2 className="text-[15px] font-bold text-text-primary">{monthLabel} özeti</h2>
            <p className="text-xs text-text-muted">
              {s.daysElapsed}/{s.daysInMonth}. gün
            </p>
          </div>
        </div>
        <Link href={`/reports?space=${spaceId}`} className="text-xs font-bold text-accent">
          Rapor →
        </Link>
      </div>
      <ul className="flex flex-col gap-2">
        {lines.map((l, i) => (
          <li key={i} className="flex gap-2.5 text-sm leading-snug text-text-secondary">
            <span
              aria-hidden="true"
              className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${l.tone === "good" ? "bg-income" : l.tone === "bad" ? "bg-expense" : "bg-accent"}`}
            />
            <span className="min-w-0 [&_strong]:text-text-primary">{l.text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
