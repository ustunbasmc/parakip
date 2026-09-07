"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cancelDebt, cancelDebtPayment } from "@/lib/api/financial-rpc";
import { formatCentsAsCurrency } from "@/lib/format/amount";
import { formatDueDateLabel } from "@/lib/format/date";
import { AppShell } from "@/components/AppShell";
import { Modal } from "@/components/Modal";
import { Button } from "@/components/Button";
import { ErrorBanner } from "@/components/ErrorBanner";
import { ConfirmModal } from "@/components/ConfirmModal";
import { CardEmptyState } from "@/components/dashboard/DashboardCard";
import { PlusIcon, LockIcon } from "@/components/icons";
import { AddPaymentForm } from "@/components/debts/AddPaymentForm";
import type { DebtDetail } from "@/lib/dashboard/debts";
import type { AccountOption } from "@/lib/dashboard/formData";

const STATUS_LABEL: Record<string, string> = {
  open: "Açık",
  partial: "Kısmi ödendi",
  paid: "Ödendi",
  cancelled: "İptal edildi",
};

function formatFullDate(iso: string) {
  return new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));
}

interface Props {
  debt: DebtDetail;
  accounts: AccountOption[];
  canManage: boolean; // owner/admin — iptal işlemleri için
  backHref: string;
}

export function DebtDetailView({ debt, accounts, canManage, backHref }: Props) {
  const router = useRouter();
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [addPaymentDirty, setAddPaymentDirty] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [paymentToCancel, setPaymentToCancel] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPayable = debt.direction === "payable";
  const isSettled = debt.status === "paid" || debt.status === "cancelled";

  async function handleCancelDebt() {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: rpcError } = await cancelDebt(supabase, { p_debt_id: debt.id });
    setLoading(false);
    setCancelModalOpen(false);
    if (rpcError) {
      setError(rpcError.message || "İptal edilemedi.");
      return;
    }
    router.refresh();
  }

  async function handleCancelPayment() {
    if (!paymentToCancel) return;
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: rpcError } = await cancelDebtPayment(supabase, { p_payment_id: paymentToCancel });
    setLoading(false);
    setPaymentToCancel(null);
    if (rpcError) {
      setError(rpcError.message || "Ödeme iptal edilemedi.");
      return;
    }
    router.refresh();
  }

  function confirmCloseAddPayment() {
    if (addPaymentDirty) return window.confirm("Kaydedilmemiş değişiklikler var. Kapatmak istediğine emin misin?");
    return true;
  }

  function handleCloseAddPayment() {
    if (!confirmCloseAddPayment()) return;
    setShowAddPayment(false);
    setAddPaymentDirty(false);
  }

  function handleAddPaymentSuccess() {
    setShowAddPayment(false);
    setAddPaymentDirty(false);
    router.refresh();
  }

  return (
    <AppShell variant="subpage" title="Borç/Alacak detayı" backFallbackHref={backHref}>
      <div className="flex flex-col gap-5 pt-3 pb-4">
        {error ? <ErrorBanner message={error} /> : null}

        <div className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-surface p-6 text-center">
          <p className="text-sm text-text-muted">{debt.counterpartyName}</p>
          <p className={`text-3xl font-extrabold tabular-nums ${isPayable ? "text-danger" : "text-success"}`}>
            {formatCentsAsCurrency(debt.remainingCents, "TRY")}
          </p>
          <p className="text-xs text-text-muted">
            {formatCentsAsCurrency(debt.principalCents, "TRY")} üzerinden ·{" "}
            {formatCentsAsCurrency(debt.paidCents, "TRY")} ödendi
          </p>
          <span className="mt-1 rounded-full bg-surface-muted px-2.5 py-1 text-xs font-bold text-text-secondary">
            {STATUS_LABEL[debt.status] ?? debt.status}
          </span>
        </div>

        <div className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-surface px-4">
          <div className="flex items-center justify-between py-3 first:pt-3.5">
            <span className="text-sm text-text-secondary">Tür</span>
            <span className="text-sm font-medium text-text-primary">{isPayable ? "Borç" : "Alacak"}</span>
          </div>
          {debt.dueDate ? (
            <div className="flex items-center justify-between py-3">
              <span className="text-sm text-text-secondary">Vade</span>
              <span className="text-sm font-medium text-text-primary">{formatDueDateLabel(debt.dueDate)}</span>
            </div>
          ) : null}
          {debt.note ? (
            <div className="flex items-center justify-between py-3 last:pb-3.5">
              <span className="text-sm text-text-secondary">Açıklama</span>
              <span className="max-w-[60%] truncate text-right text-sm font-medium text-text-primary">{debt.note}</span>
            </div>
          ) : null}
        </div>

        {!isSettled ? (
          <Button variant="secondary" onClick={() => setShowAddPayment(true)} fullWidth={false}>
            <PlusIcon size={16} />
            Ödeme ekle
          </Button>
        ) : null}

        <section>
          <p className="mb-2 text-sm font-semibold text-text-secondary">Ödeme geçmişi</p>
          {debt.payments.length === 0 ? (
            <CardEmptyState message="Henüz ödeme kaydı yok." />
          ) : (
            <div className="flex flex-col gap-2">
              {debt.payments.map((p) => (
                <div
                  key={p.id}
                  className={`flex items-center justify-between rounded-2xl border p-3.5 ${
                    p.status === "cancelled" ? "border-border opacity-60" : "border-border bg-surface"
                  }`}
                >
                  <div>
                    <p className={`text-sm font-semibold tabular-nums ${p.status === "cancelled" ? "text-text-muted line-through" : "text-text-primary"}`}>
                      {formatCentsAsCurrency(p.amountCents, "TRY")}
                    </p>
                    <p className="text-xs text-text-muted">
                      {formatFullDate(p.paidAt)} · {p.isExternal ? "Harici/manuel" : "Hesap hareketiyle"}
                      {p.status === "cancelled" ? " · İptal edildi" : ""}
                    </p>
                  </div>
                  {canManage && p.status === "active" ? (
                    <button
                      onClick={() => setPaymentToCancel(p.id)}
                      className="text-xs font-semibold text-danger"
                    >
                      İptal et
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </section>

        {canManage && !isSettled ? (
          <Button variant="ghost" onClick={() => setCancelModalOpen(true)} fullWidth={false}>
            Borcu/alacağı iptal et
          </Button>
        ) : null}

        <div className="flex items-start gap-2 rounded-2xl bg-surface-muted p-3.5 text-xs text-text-muted">
          <LockIcon size={14} className="mt-0.5 shrink-0" />
          <p>Borç/alacak ve ödeme kayıtları hiçbir zaman fiziksel olarak silinmez — yalnızca iptal edilebilir.</p>
        </div>
      </div>

      <Modal
        open={showAddPayment}
        title={debt.direction === "payable" ? "Ödeme ekle" : "Tahsilat ekle"}
        onClose={handleCloseAddPayment}
        confirmClose={confirmCloseAddPayment}
      >
        <AddPaymentForm
          debtId={debt.id}
          bookId={debt.bookId}
          direction={debt.direction}
          remainingCents={debt.remainingCents}
          accounts={accounts}
          onDone={handleAddPaymentSuccess}
          onDirtyChange={setAddPaymentDirty}
        />
      </Modal>

      <ConfirmModal
        open={cancelModalOpen}
        title="Borcu/alacağı iptal et"
        description={`"${debt.counterpartyName}" kaydı iptal edilecek. Bu işlem geri alınamaz, ama kayıt geçmişte görünmeye devam eder.`}
        confirmLabel="İptal et"
        danger
        loading={loading}
        onConfirm={handleCancelDebt}
        onCancel={() => setCancelModalOpen(false)}
      />

      <ConfirmModal
        open={paymentToCancel !== null}
        title="Ödemeyi iptal et"
        description="Bu ödeme iptal edilecek ve borcun kalan tutarı yeniden artacak. Bu işlem geri alınamaz."
        confirmLabel="İptal et"
        danger
        loading={loading}
        onConfirm={handleCancelPayment}
        onCancel={() => setPaymentToCancel(null)}
      />
    </AppShell>
  );
}
