"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { archiveAccount, archiveAccountAndCancelTransactions } from "@/lib/api/financial-rpc";
import { formatCentsAsCurrency } from "@/lib/format/amount";
import { accountTypeLabel } from "@/lib/format/accountType";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { TextField } from "@/components/TextField";
import { ErrorBanner } from "@/components/ErrorBanner";
import { ConfirmModal } from "@/components/ConfirmModal";
import { ReauthPasswordModal } from "@/components/settings/ReauthPasswordModal";
import { CardEmptyState, CardError } from "@/components/dashboard/DashboardCard";
import { TransactionListItem } from "@/components/transactions/TransactionListItem";
import { ArchiveIcon, WalletIcon, CreditCardIcon, TrendingUpIcon } from "@/components/icons";
import type { AccountWithBalance } from "@/lib/dashboard/formData";
import type { TransactionHistoryRow } from "@/lib/dashboard/transactionHistory";

const TYPE_ICON: Record<string, typeof WalletIcon> = {
  credit_card: CreditCardIcon,
  investment_cash: TrendingUpIcon,
};

const TYPED_CONFIRMATION = "HESABI ARŞİVLE";

interface Props {
  account: AccountWithBalance & { note?: string | null; bookId: string };
  canArchive: boolean;
  homeHref: string;
  accountsHref: string;
  spaceParam: string;
  recentTransactions: TransactionHistoryRow[];
  recentError: boolean;
  userEmail: string;
}

export function AccountDetailView({
  account,
  canArchive,
  homeHref,
  accountsHref,
  spaceParam,
  recentTransactions,
  recentError,
  userEmail,
}: Props) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // "Hesabı arşivle ve işlemleri iptal et" — çok daha yıkıcı bir işlem
  // olduğu için AYRI, çok adımlı bir akış: şifre doğrulama → yazılı
  // onay ("HESABI ARŞİVLE") → atomik RPC.
  const [dangerStep, setDangerStep] = useState<"idle" | "reauth" | "typed">("idle");
  const [typedText, setTypedText] = useState("");
  const [dangerLoading, setDangerLoading] = useState(false);
  const [dangerError, setDangerError] = useState<string | null>(null);
  const [dangerResult, setDangerResult] = useState<number | null>(null);

  const Icon = TYPE_ICON[account.type] ?? WalletIcon;
  const negative = account.balanceCents < 0;
  const willArchive = !account.isArchived;

  async function handleConfirm() {
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: rpcError } = await archiveAccount(supabase, {
      p_account_id: account.id,
      p_archived: willArchive,
    });

    setLoading(false);

    if (rpcError) {
      setModalOpen(false);
      setError(rpcError.message || "İşlem gerçekleştirilemedi.");
      return;
    }

    setModalOpen(false);
    router.push(accountsHref);
  }

  async function handleDangerConfirm() {
    if (typedText.trim().toUpperCase() !== TYPED_CONFIRMATION) {
      setDangerError(`Devam etmek için tam olarak "${TYPED_CONFIRMATION}" yazmalısın.`);
      return;
    }
    setDangerLoading(true);
    setDangerError(null);
    const supabase = createClient();
    const { data, error: rpcError } = await archiveAccountAndCancelTransactions(supabase, { p_account_id: account.id });
    setDangerLoading(false);
    if (rpcError) {
      setDangerError(rpcError.message || "İşlem gerçekleştirilemedi.");
      return;
    }
    setDangerStep("idle");
    setTypedText("");
    setDangerResult(typeof data === "number" ? data : null);
    router.refresh();
  }

  return (
    <AppShell variant="subpage" title="Hesap detayı" backFallbackHref={homeHref}>
      <div className="flex flex-col gap-5 pt-3 pb-4">
        {error ? <ErrorBanner message={error} /> : null}

        <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface p-6 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-muted text-text-secondary">
            <Icon size={26} />
          </span>
          <div>
            <p className="text-lg font-bold text-text-primary">{account.name}</p>
            <p className="text-sm text-text-muted">
              {accountTypeLabel(account.type)} · {account.currency}
              {account.isArchived ? " · Arşivlenmiş" : ""}
            </p>
          </div>
          <p className={`text-3xl font-extrabold tabular-nums ${negative ? "text-danger" : "text-text-primary"}`}>
            {formatCentsAsCurrency(account.balanceCents, account.currency)}
          </p>
        </div>

        {account.note ? (
          <div className="rounded-2xl border border-border bg-surface p-4">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">Açıklama</p>
            <p className="text-sm text-text-primary">{account.note}</p>
          </div>
        ) : null}

        {canArchive ? (
          <Button variant="secondary" onClick={() => setModalOpen(true)} fullWidth={false}>
            <ArchiveIcon size={16} />
            {willArchive ? "Hesabı arşivle" : "Arşivden çıkar"}
          </Button>
        ) : !account.isArchived ? (
          <p className="text-center text-xs text-text-muted">
            Bu hesabı yalnızca alanın sahibi veya yöneticisi arşivleyebilir.
          </p>
        ) : null}

        {canArchive && !account.isArchived ? (
          <div className="rounded-2xl border border-dashed border-danger/40 p-4">
            <p className="text-sm font-semibold text-danger">Tehlikeli işlem</p>
            <p className="mt-1 text-xs text-text-muted">
              Bu hesaba bağlı TÜM aktif işlemleri de iptal etmek istiyorsan (ör. yanlışlıkla oluşturulmuş bir hesabı
              tamamen kapatmak için), aşağıdaki seçeneği kullan. İşlemler fiziksel olarak SİLİNMEZ — yalnızca iptal
              edilir ve geçmişte görünmeye devam eder.
            </p>
            {dangerError ? <ErrorBanner message={dangerError} /> : null}
            {dangerResult !== null ? (
              <p className="mt-2 text-xs text-success">{dangerResult} işlem iptal edildi ve hesap arşivlendi.</p>
            ) : null}
            <Button variant="ghost" onClick={() => setDangerStep("reauth")} fullWidth={false} className="mt-3 !text-danger">
              Hesabı arşivle ve işlemleri iptal et
            </Button>
          </div>
        ) : null}

        <ReauthPasswordModal
          open={dangerStep === "reauth"}
          email={userEmail}
          title="Hesabı arşivle ve işlemleri iptal et"
          onSuccess={() => setDangerStep("typed")}
          onCancel={() => setDangerStep("idle")}
        />

        {dangerStep === "typed" ? (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 sm:items-center"
            onClick={() => {
              setDangerStep("idle");
              setTypedText("");
              setDangerError(null);
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-t-3xl border border-border bg-bg-elevated p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-xl sm:rounded-3xl"
            >
              <h2 className="text-lg font-bold text-text-primary">Son onay</h2>
              <p className="mt-1.5 text-sm text-text-secondary">
                {`"${account.name}" hesabına bağlı TÜM aktif işlemler iptal edilecek ve hesap arşivlenecek (fiziksel silme YOK, yalnızca iptal). Devam etmek için aşağıya tam olarak "${TYPED_CONFIRMATION}" yaz.`}
              </p>
              {dangerError ? <ErrorBanner message={dangerError} /> : null}
              <TextField
                label={TYPED_CONFIRMATION}
                value={typedText}
                onChange={(e) => setTypedText(e.target.value)}
                autoFocus
              />
              <div className="mt-4 flex flex-col gap-2.5">
                <Button onClick={handleDangerConfirm} loading={dangerLoading} className="!bg-danger">
                  Onayla ve uygula
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setDangerStep("idle");
                    setTypedText("");
                    setDangerError(null);
                  }}
                  disabled={dangerLoading}
                >
                  Vazgeç
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        <section className="rounded-2xl border border-border bg-surface p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text-secondary">Son işlemler</h2>
            <Link
              href={`/transactions?account=${account.id}&space=${spaceParam}`}
              className="text-xs font-semibold text-accent"
            >
              Tüm işlemleri gör
            </Link>
          </div>

          {recentError ? (
            <CardError message="Son işlemler yüklenemedi." />
          ) : recentTransactions.length === 0 ? (
            <CardEmptyState
              message="Bu hesapta henüz işlem yok."
              hint="Gelir, gider veya transfer eklediğinde burada görünecek."
            />
          ) : (
            <div className="flex flex-col gap-2">
              {recentTransactions.map((row) => (
                <TransactionListItem key={row.entryId} row={row} spaceParam={spaceParam} bookId={account.bookId} />
              ))}
            </div>
          )}
        </section>
      </div>

      <ConfirmModal
        open={modalOpen}
        title={willArchive ? "Hesabı arşivle" : "Hesabı arşivden çıkar"}
        description={
          willArchive
            ? `"${account.name}" arşivlendiğinde yeni işlem ekleyemezsin, ama geçmiş işlem kayıtları hiçbir zaman silinmez ve dilediğin zaman arşivden çıkarabilirsin.`
            : `"${account.name}" tekrar aktif hale gelecek ve yeni işlem eklemek için kullanılabilecek.`
        }
        confirmLabel={willArchive ? "Arşivle" : "Arşivden çıkar"}
        loading={loading}
        onConfirm={handleConfirm}
        onCancel={() => setModalOpen(false)}
      />
    </AppShell>
  );
}
