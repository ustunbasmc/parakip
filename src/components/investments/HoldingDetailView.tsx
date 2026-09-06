"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cancelHoldingTransaction } from "@/lib/api/financial-rpc";
import { formatCentsAsCurrency } from "@/lib/format/amount";
import { assetTypeLabel } from "@/lib/dashboard/investments";
import { AppShell } from "@/components/AppShell";
import { CardEmptyState } from "@/components/dashboard/DashboardCard";
import { SwipeToAction } from "@/components/SwipeToAction";
import { ConfirmModal } from "@/components/ConfirmModal";
import { LockIcon } from "@/components/icons";
import type { HoldingDetail, HoldingTransactionRow } from "@/lib/dashboard/investments";

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));
}

export function HoldingDetailView({
  holding,
  transactions,
  canManage,
  backHref,
}: {
  holding: HoldingDetail;
  transactions: HoldingTransactionRow[];
  canManage: boolean;
  backHref: string;
}) {
  const router = useRouter();
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasPrice = holding.currentValueCents !== null;

  // LIFO kuralı: yalnızca EN SON aktif işlem iptal edilebilir (bkz. 0034/0036).
  const lastActiveId = transactions.find((t) => t.status === "active")?.id ?? null;

  async function handleCancel() {
    if (!cancelTarget) return;
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: rpcError } = await cancelHoldingTransaction(supabase, { p_holding_transaction_id: cancelTarget });
    setLoading(false);
    setCancelTarget(null);
    if (rpcError) {
      setError(rpcError.message || "İşlem iptal edilemedi.");
      return;
    }
    router.refresh();
  }

  return (
    <AppShell variant="subpage" title={holding.assetSymbol} backFallbackHref={backHref}>
      <div className="flex flex-col gap-5 pt-3 pb-4">
        {error ? <p className="text-sm text-danger">{error}</p> : null}

        <div className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-surface p-6 text-center">
          <p className="text-sm text-text-muted">
            {assetTypeLabel(holding.assetType)} · {holding.quantity} adet
          </p>
          <p className="text-3xl font-extrabold tabular-nums text-text-primary">
            {formatCentsAsCurrency(hasPrice ? holding.currentValueCents! : holding.totalCostBasisCents, holding.currency)}
          </p>
          {hasPrice ? (
            <p className={`text-sm font-semibold ${holding.unrealizedGainCents! >= 0 ? "text-success" : "text-danger"}`}>
              {holding.unrealizedGainCents! >= 0 ? "+" : ""}
              {formatCentsAsCurrency(holding.unrealizedGainCents!, holding.currency)} gerçekleşmemiş
              {holding.priceIsStale ? " · fiyat güncel olmayabilir" : ""}
            </p>
          ) : (
            <p className="text-xs text-text-muted">Güncel piyasa fiyatı mevcut değil — maliyet tabanı gösteriliyor.</p>
          )}
        </div>

        <div className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-surface px-4">
          <div className="flex items-center justify-between py-3 first:pt-3.5">
            <span className="text-sm text-text-secondary">Ortalama maliyet</span>
            <span className="text-sm font-medium text-text-primary">
              {formatCentsAsCurrency(Math.round(holding.avgCostPerUnitCents), holding.currency)} / adet
            </span>
          </div>
          <div className="flex items-center justify-between py-3">
            <span className="text-sm text-text-secondary">Toplam maliyet</span>
            <span className="text-sm font-medium text-text-primary">{formatCentsAsCurrency(holding.totalCostBasisCents, holding.currency)}</span>
          </div>
          <div className="flex items-center justify-between py-3 last:pb-3.5">
            <span className="text-sm text-text-secondary">Gerçekleşmiş K/Z</span>
            <span className={`text-sm font-medium ${holding.realizedGainCents >= 0 ? "text-success" : "text-danger"}`}>
              {holding.realizedGainCents >= 0 ? "+" : ""}
              {formatCentsAsCurrency(holding.realizedGainCents, holding.currency)}
            </span>
          </div>
        </div>

        <section>
          <p className="mb-2 text-sm font-semibold text-text-secondary">İşlem geçmişi</p>
          {transactions.length === 0 ? (
            <CardEmptyState message="Henüz işlem yok." />
          ) : (
            <div className="flex flex-col gap-2">
              {transactions.map((t) => {
                const canCancelThis = canManage && t.status === "active" && t.id === lastActiveId;
                const row = (
                  <div
                    className={`flex items-center justify-between rounded-2xl border p-3.5 ${t.status === "cancelled" ? "border-border opacity-60" : "border-border bg-surface"}`}
                  >
                    <div>
                      <p className={`text-sm font-semibold ${t.status === "cancelled" ? "text-text-muted line-through" : t.type === "buy" ? "text-danger" : "text-success"}`}>
                        {t.type === "buy" ? "Alış" : "Satış"} · {t.quantity} adet
                      </p>
                      <p className="text-xs text-text-muted">
                        {formatDate(t.occurredAt)} · {formatCentsAsCurrency(t.priceCents, holding.currency)}/adet
                        {t.status === "cancelled" ? " · İptal edildi" : ""}
                      </p>
                    </div>
                    {canCancelThis ? (
                      <button onClick={() => setCancelTarget(t.id)} className="hidden text-xs font-semibold text-danger md:block">
                        İptal et
                      </button>
                    ) : null}
                  </div>
                );

                return canCancelThis ? (
                  <SwipeToAction key={t.id} actionLabel="İptal et" onAction={() => setCancelTarget(t.id)}>
                    {row}
                  </SwipeToAction>
                ) : (
                  <div key={t.id}>{row}</div>
                );
              })}
            </div>
          )}
        </section>

        <div className="flex items-start gap-2 rounded-2xl bg-surface-muted p-3.5 text-xs text-text-muted">
          <LockIcon size={14} className="mt-0.5 shrink-0" />
          <p>Yalnızca en son işlem iptal edilebilir; kayıtlar fiziksel olarak silinmez.</p>
        </div>
      </div>

      <ConfirmModal
        open={cancelTarget !== null}
        title="İşlemi iptal et"
        description="Bu işlem iptal edilecek: varlık miktarı ve maliyet tabanı bu işlem öncesine geri alınacak, bağlı hesap hareketi (nakit girişi/çıkışı) de otomatik geri alınacak — hepsi TEK bir işlemde atomik olarak gerçekleşir. Yalnızca bu varlıktaki EN SON aktif işlem iptal edilebilir. Bu işlem geri alınamaz."
        confirmLabel="İptal et"
        danger
        loading={loading}
        onConfirm={handleCancel}
        onCancel={() => setCancelTarget(null)}
      />
    </AppShell>
  );
}
