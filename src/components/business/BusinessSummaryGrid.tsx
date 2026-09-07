"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCentsAsCurrency } from "@/lib/format/amount";
import { getBusinessSummary, BUSINESS_PERIOD_LABELS, type BusinessSummary, type BusinessPeriod } from "@/lib/dashboard/business";

const PERIODS: BusinessPeriod[] = ["today", "yesterday", "week", "month", "lastMonth", "year"];

/**
 * İşletme dashboard'unun özet kartı — TEK bir seçilebilir döneme göre
 * (bugün/dün/bu hafta/bu ay/geçen ay/bu yıl) Satış/Alış/Masraf/Brüt kâr
 * gösterir; Bekleyen tahsilat/ödeme ve Kasa/Banka bakiyesi ise HER ZAMAN
 * "şu an itibarıyla" (dönemden bağımsız) gösterilir — bu ayrım kartların
 * altında açıkça belirtilir, kafa karışıklığı YARATILMAZ.
 *
 * İlk render sunucudan gelen "today" özetini kullanır (sayfa ilk
 * yüklemesi YAVAŞLAMAZ); dönem değiştirildiğinde yalnızca o an, istemci
 * tarafında taze veri çekilir.
 */
export function BusinessSummaryGrid({ bookId, initialSummary }: { bookId: string; initialSummary: BusinessSummary }) {
  const [period, setPeriod] = useState<BusinessPeriod>(initialSummary.period);
  const [summary, setSummary] = useState<BusinessSummary>(initialSummary);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  async function handlePeriodChange(next: BusinessPeriod) {
    if (next === period) return;
    setPeriod(next);
    setLoading(true);
    setError(false);
    const supabase = createClient();
    try {
      setSummary(await getBusinessSummary(supabase, bookId, next));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  const periodItems: { label: string; cents: number; tone: "success" | "danger" | "neutral" }[] = [
    { label: "Satış", cents: summary.periodSalesCents, tone: "success" },
    { label: "Alış", cents: summary.periodPurchasesCents, tone: "danger" },
    { label: "Masraf", cents: summary.periodExpenseCents, tone: "danger" },
    { label: "Brüt kâr", cents: summary.grossProfitCents, tone: summary.grossProfitCents >= 0 ? "success" : "danger" },
  ];

  const statusItems: { label: string; cents: number; tone: "success" | "danger" | "neutral" }[] = [
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
    <div className="rounded-2xl border border-border bg-surface p-4">
      {/* Dönem seçici — yatay kaydırılabilir pill grubu, sayfa dışına taşmaz. */}
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {PERIODS.map((p) => (
          <button
            key={p}
            onClick={() => handlePeriodChange(p)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              p === period ? "bg-accent text-text-on-accent" : "bg-surface-muted text-text-secondary"
            }`}
          >
            {BUSINESS_PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      {error ? (
        <p className="py-6 text-center text-sm text-danger">Veriler yüklenemedi. Lütfen tekrar dene.</p>
      ) : (
        <div className={`mt-3.5 transition-opacity ${loading ? "opacity-50" : "opacity-100"}`}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
            {BUSINESS_PERIOD_LABELS[period]}
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {periodItems.map((item) => (
              <div key={item.label} className="rounded-xl bg-surface-muted p-3">
                <p className="text-xs text-text-muted">{item.label}</p>
                <p className={`mt-1 truncate text-base font-bold tabular-nums ${toneClass[item.tone]}`}>
                  {formatCentsAsCurrency(item.cents, "TRY")}
                </p>
              </div>
            ))}
          </div>

          <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-text-muted">Şu an itibarıyla</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {statusItems.map((item) => (
              <div key={item.label} className="rounded-xl bg-surface-muted p-3">
                <p className="text-xs text-text-muted">{item.label}</p>
                <p className={`mt-1 truncate text-base font-bold tabular-nums ${toneClass[item.tone]}`}>
                  {formatCentsAsCurrency(item.cents, "TRY")}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
