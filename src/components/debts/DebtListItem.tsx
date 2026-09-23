"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cancelDebt } from "@/lib/api/financial-rpc";
import { formatCentsAsCurrency } from "@/lib/format/amount";
import { formatDueDateLabel } from "@/lib/format/date";
import { SwipeToAction } from "@/components/SwipeToAction";
import { ConfirmModal } from "@/components/ConfirmModal";
import { ProgressBar } from "@/components/ui/ProgressBar";
import type { DebtRow } from "@/lib/dashboard/debts";

const STATUS_LABEL: Record<string, string> = {
  open: "Açık",
  partial: "Kısmi ödendi",
  paid: "Ödendi",
  cancelled: "İptal edildi",
};

export function DebtListItem({ debt, spaceParam }: { debt: DebtRow; spaceParam: string }) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPayable = debt.direction === "payable";
  const isOverdue = debt.dueDate ? debt.dueDate < new Date().toISOString().slice(0, 10) : false;
  // Ödenmiş/iptal edilmiş bir borç ASLA iptal edilemez (bkz. cancel_debt) — kaydırma bu durumda devre dışı.
  const isSettled = debt.status === "paid" || debt.status === "cancelled";
  const hasActivePayments = debt.paidCents > 0;

  async function handleCancel() {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: rpcError } = await cancelDebt(supabase, { p_debt_id: debt.id });
    setLoading(false);
    setConfirmOpen(false);
    if (rpcError) {
      setError(rpcError.message || "İptal edilemedi.");
      return;
    }
    router.refresh();
  }

  // Ödenen oran — yalnızca görsel; değerler debt_balances view'ından gelir.
  const paidPercent = debt.principalCents > 0 ? (debt.paidCents / debt.principalCents) * 100 : 0;
  const statusTone =
    debt.status === "paid"
      ? "bg-income-soft text-income"
      : debt.status === "cancelled"
        ? "bg-surface-muted text-text-muted"
        : isOverdue
          ? "bg-danger-soft text-danger"
          : debt.status === "partial"
            ? "bg-warning-soft text-warning"
            : "bg-balance-soft text-balance";

  const card = (
    <Link
      href={`/debts/${debt.id}?space=${spaceParam}`}
      className={`surface-card flex min-w-0 flex-col gap-2.5 rounded-2xl p-3.5 transition-colors active:bg-surface-muted ${
        isSettled ? "opacity-60" : ""
      }`}
      style={isOverdue && !isSettled ? { borderColor: "color-mix(in srgb, var(--color-danger) 45%, var(--color-border))" } : undefined}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span
          aria-hidden="true"
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-base font-black ${
            isPayable ? "bg-expense-soft text-expense" : "bg-income-soft text-income"
          }`}
        >
          {isPayable ? "−" : "+"}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-text-primary">{debt.counterpartyName}</p>
          <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-1">
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${statusTone}`}>
              {isOverdue && !isSettled ? "Vadesi geçti" : STATUS_LABEL[debt.status] ?? debt.status}
            </span>
            {debt.dueDate ? <span className="truncate text-[11px] text-text-muted">{formatDueDateLabel(debt.dueDate)}</span> : null}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className={`text-sm font-bold tabular-nums ${isPayable ? "text-expense" : "text-income"}`}>
            {formatCentsAsCurrency(debt.remainingCents, "TRY")}
          </p>
          <p className="text-[10px] text-text-muted">{isPayable ? "kalan borç" : "kalan alacak"}</p>
        </div>
      </div>

      {debt.paidCents > 0 && debt.principalCents > 0 ? (
        <div className="flex min-w-0 flex-col gap-1">
          <ProgressBar percent={paidPercent} tone={isPayable ? "expense" : "income"} size="sm" label={isPayable ? "Ödenen oran" : "Tahsil edilen oran"} />
          <p className="flex justify-between gap-2 text-[10px] tabular-nums text-text-muted">
            <span className="truncate">
              {isPayable ? "Ödenen" : "Tahsil edilen"} {formatCentsAsCurrency(debt.paidCents, "TRY")}
            </span>
            <span className="shrink-0">Toplam {formatCentsAsCurrency(debt.principalCents, "TRY")}</span>
          </p>
        </div>
      ) : null}
    </Link>
  );

  return (
    <div>
      {error ? <p className="mb-1.5 px-1 text-xs text-danger">{error}</p> : null}
      <SwipeToAction actionLabel="İptal et" onAction={() => setConfirmOpen(true)} disabled={isSettled}>
        {card}
      </SwipeToAction>

      <ConfirmModal
        open={confirmOpen}
        title="Borcu/alacağı iptal et"
        description={
          hasActivePayments
            ? `"${debt.counterpartyName}" için ${formatCentsAsCurrency(debt.paidCents, "TRY")} tutarında aktif ödeme/tahsilat bağlantısı var. İptal etsen bile bu ödemeler geçmişte kalır, ama kayıt tamamen kapanır. Bu işlem geri alınamaz.`
            : `"${debt.counterpartyName}" kaydı iptal edilecek. Bu işlem geri alınamaz, ama kayıt geçmişte görünmeye devam eder.`
        }
        confirmLabel="İptal et"
        danger
        loading={loading}
        onConfirm={handleCancel}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
