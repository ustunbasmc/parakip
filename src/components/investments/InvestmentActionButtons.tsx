"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getAccountsForBook, type AccountOption } from "@/lib/dashboard/formData";
import { getOrCreatePortfolioForBook, type HoldingRow } from "@/lib/dashboard/investments";
import { Modal } from "@/components/Modal";
import { InvestmentBuyForm } from "@/components/investments/InvestmentBuyForm";
import { InvestmentSellForm } from "@/components/investments/InvestmentSellForm";
import { PlusIcon, ArrowDownRightIcon } from "@/components/icons";

export function InvestmentActionButtons({
  bookId,
  spaceParam,
  holdings,
}: {
  bookId: string;
  spaceParam: string;
  holdings: HoldingRow[];
}) {
  const router = useRouter();
  const [modalKind, setModalKind] = useState<"buy" | "sell" | null>(null);
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [portfolioId, setPortfolioId] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  async function openModal(kind: "buy" | "sell") {
    setModalKind(kind);
    setLoading(true);
    const supabase = createClient();
    try {
      const [acc, pId] = await Promise.all([
        getAccountsForBook(supabase, bookId),
        getOrCreatePortfolioForBook(supabase, bookId),
      ]);
      setAccounts(acc);
      setPortfolioId(pId);
    } finally {
      setLoading(false);
    }
  }

  function confirmClose() {
    if (isDirty) return window.confirm("Kaydedilmemiş değişiklikler var. Kapatmak istediğine emin misin?");
    return true;
  }

  function handleClose() {
    if (!confirmClose()) return;
    setModalKind(null);
    setIsDirty(false);
  }

  function handleSuccess() {
    setModalKind(null);
    setIsDirty(false);
    router.refresh();
  }

  return (
    <>
      <div className="flex gap-2">
        <button
          onClick={() => openModal("buy")}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-accent py-3 text-sm font-bold text-text-on-accent"
        >
          <PlusIcon size={16} />
          Alış yap
        </button>
        <button
          onClick={() => openModal("sell")}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl border border-border bg-surface py-3 text-sm font-bold text-text-primary"
        >
          <ArrowDownRightIcon size={16} />
          Satış yap
        </button>
      </div>

      <Modal
        open={modalKind !== null}
        title={modalKind === "buy" ? "Yatırım alışı" : "Yatırım satışı"}
        onClose={handleClose}
        confirmClose={confirmClose}
      >
        {loading || !portfolioId ? (
          <p className="py-8 text-center text-sm text-text-muted">Yükleniyor...</p>
        ) : modalKind === "buy" ? (
          <InvestmentBuyForm
            portfolioId={portfolioId}
            homeHref={`/investments?space=${spaceParam}`}
            accounts={accounts}
            variant="modal"
            onSuccess={handleSuccess}
            onDirtyChange={setIsDirty}
          />
        ) : modalKind === "sell" ? (
          <InvestmentSellForm
            portfolioId={portfolioId}
            homeHref={`/investments?space=${spaceParam}`}
            holdings={holdings}
            accounts={accounts}
            variant="modal"
            onSuccess={handleSuccess}
            onDirtyChange={setIsDirty}
          />
        ) : null}
      </Modal>
    </>
  );
}
