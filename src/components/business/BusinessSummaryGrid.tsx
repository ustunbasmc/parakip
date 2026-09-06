import { formatCentsAsCurrency } from "@/lib/format/amount";
import type { BusinessSummary } from "@/lib/dashboard/business";

/**
 * İşletme dashboard'unun öncelik sırasına göre 8 KPI kartı: Bugünkü
 * satış, Bu ayki satış, Bu ayki alış/gider, Brüt kâr, Bekleyen tahsilat,
 * Bekleyen ödeme, Kasa bakiyesi, Banka bakiyesi. Tüm veriler mevcut
 * ledger/borç sorgularından türetilir (bkz. business.ts) — sahte/tahmini
 * değer YOKTUR.
 */
export function BusinessSummaryGrid({ summary }: { summary: BusinessSummary }) {
  const items: { label: string; cents: number; tone?: "success" | "danger" | "neutral" }[] = [
    { label: "Bugünkü satış", cents: summary.todaySalesCents, tone: "success" },
    { label: "Bugünkü alış", cents: summary.todayPurchasesCents, tone: "danger" },
    { label: "Bugünkü masraf", cents: summary.todayExpenseCents, tone: "danger" },
    { label: "Bu ay satış", cents: summary.monthSalesCents, tone: "success" },
    { label: "Bu ay alış", cents: summary.monthPurchasesCents, tone: "danger" },
    { label: "Bu ay masraf", cents: summary.monthExpenseCents, tone: "danger" },
    { label: "Brüt kâr ön izlemesi", cents: summary.grossProfitCents, tone: summary.grossProfitCents >= 0 ? "success" : "danger" },
    { label: "Bekleyen tahsilat", cents: summary.pendingReceivableCents, tone: "success" },
    { label: "Bekleyen ödeme", cents: summary.pendingPayableCents, tone: "danger" },
    { label: "Kasa bakiyesi", cents: summary.cashBalanceCents, tone: "neutral" },
    { label: "Banka bakiyesi", cents: summary.bankBalanceCents, tone: "neutral" },
  ];

  const toneClass: Record<string, string> = {
    success: "text-success",
    danger: "text-danger",
    neutral: "text-text-primary",
  };

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="rounded-2xl border border-border bg-surface p-3.5">
          <p className="text-xs text-text-muted">{item.label}</p>
          <p className={`mt-1 truncate text-lg font-bold tabular-nums ${toneClass[item.tone ?? "neutral"]}`}>
            {formatCentsAsCurrency(item.cents, "TRY")}
          </p>
        </div>
      ))}
    </div>
  );
}
