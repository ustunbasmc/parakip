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

  const card = (
    <Link
      href={`/debts/${debt.id}?space=${spaceParam}`}
      className={`flex items-center gap-3 rounded-2xl border bg-surface p-3.5 transition-colors active:bg-surface-muted ${
        isOverdue && !isSettled ? "border-danger/40" : "border-border"
      } ${isSettled ? "opacity-60" : ""}`}
    >
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
          isPayable ? "bg-danger-soft text-danger" : "bg-success-soft text-success"
        }`}
      >
        {isPayable ? "−" : "+"}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-text-primary">{debt.counterpartyName}</p>
        <p className="truncate text-xs text-text-muted">
          {STATUS_LABEL[debt.status] ?? debt.status}
          {debt.dueDate ? ` · ${formatDueDateLabel(debt.dueDate)}` : ""}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className={`text-sm font-bold tabular-nums ${isPayable ? "text-danger" : "text-success"}`}>
          {formatCentsAsCurrency(debt.remainingCents, "TRY")}
        </p>
        {debt.paidCents > 0 && !isSettled ? (
          <p className="text-[10px] text-text-muted">{formatCentsAsCurrency(debt.principalCents, "TRY")} üzerinden</p>
        ) : null}
      </div>
    </Link>
  );

  return (
    <div>
      {error ? <p className="mb-1.5 px-1 text-xs text-danger">{error}</p> : null}
      {!isSettled ? (
        <SwipeToAction actionLabel="İptal et" onAction={() => setConfirmOpen(true)}>
          {card}
        </SwipeToAction>
      ) : (
        card
      )}

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
