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
      className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 transition-colors active:bg-surface-muted"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-muted text-text-secondary">
        <Icon size={20} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-text-primary">{account.name}</p>
        <p className="text-xs text-text-muted">
          {accountTypeLabel(account.type)} · {account.currency}
        </p>
      </div>
      <p className={`shrink-0 text-sm font-bold tabular-nums ${negative ? "text-danger" : "text-text-primary"}`}>
        {formatCentsAsCurrency(account.balanceCents, account.currency)}
      </p>
    </Link>
  );

  if (account.isArchived) return card;

  return (
    <div>
      {error ? <p className="mb-1.5 px-1 text-xs text-danger">{error}</p> : null}
      <SwipeToAction actionLabel="Arşivle" danger={false} onAction={() => setConfirmOpen(true)}>
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
