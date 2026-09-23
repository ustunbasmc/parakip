"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { archiveAccount } from "@/lib/api/financial-rpc";
import { formatCentsAsCurrency } from "@/lib/format/amount";
import { accountTypeLabel } from "@/lib/format/accountType";
import { WalletIcon, CreditCardIcon, TrendingUpIcon } from "@/components/icons";
import { SwipeToAction } from "@/components/SwipeToAction";
import { ConfirmModal } from "@/components/ConfirmModal";
import type { AccountWithBalance } from "@/lib/dashboard/formData";

const TYPE_ICON: Record<string, typeof WalletIcon> = {
  credit_card: CreditCardIcon,
  investment_cash: TrendingUpIcon,
};

export function AccountCard({ account, spaceParam }: { account: AccountWithBalance; spaceParam: string }) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const Icon = TYPE_ICON[account.type] ?? WalletIcon;
  const negative = account.balanceCents < 0;

  async function handleArchive() {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: rpcError } = await archiveAccount(supabase, { p_account_id: account.id, p_archived: true });
    setLoading(false);
    setConfirmOpen(false);
    if (rpcError) {
      setError(rpcError.message || "Arşivlenemedi.");
      return;
    }
    router.refresh();
  }

  const card = (
    <Link
      href={`/accounts/${account.id}?space=${spaceParam}`}
      className={`surface-card animate-rise flex min-w-0 items-center gap-3 rounded-2xl p-3.5 transition-colors active:bg-surface-muted sm:p-4 ${
        account.isArchived ? "opacity-60" : ""
      }`}
    >
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
          account.isArchived ? "bg-surface-muted text-text-muted" : negative ? "bg-expense-soft text-expense" : "bg-balance-soft text-balance"
        }`}
      >
        <Icon size={20} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-text-primary">{account.name}</p>
        <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
          <span className="truncate text-xs text-text-muted">
            {accountTypeLabel(account.type)} · {account.currency}
          </span>
          {account.isArchived ? (
            <span className="shrink-0 rounded-full bg-surface-muted px-1.5 py-0.5 text-[10px] font-bold text-text-muted">Arşiv</span>
          ) : null}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <p className={`text-sm font-bold tabular-nums sm:text-base ${negative ? "text-expense" : "text-text-primary"}`}>
          {formatCentsAsCurrency(account.balanceCents, account.currency)}
        </p>
        <p className="text-[10px] text-text-muted">bakiye</p>
      </div>
    </Link>
  );

  return (
    <div>
      {error ? <p className="mb-1.5 px-1 text-xs text-danger">{error}</p> : null}
      <SwipeToAction actionLabel="Arşivle" danger={false} onAction={() => setConfirmOpen(true)} disabled={account.isArchived}>
        {card}
      </SwipeToAction>

      <ConfirmModal
        open={confirmOpen}
        title="Hesabı arşivle"
        description={`"${account.name}" arşivlenecek. Arşivlenen hesaba yeni işlem eklenemez, ama geçmiş hareketleri korunur ve hiçbir kayıt silinmez.`}
        confirmLabel="Arşivle"
        loading={loading}
        onConfirm={handleArchive}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
