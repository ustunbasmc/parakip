"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createInvestmentSell } from "@/lib/api/financial-rpc";
import { amountInputToCents } from "@/lib/format/amount";
import { AppShell } from "@/components/AppShell";
import { TextField } from "@/components/TextField";
import { AmountInput } from "@/components/AmountInput";
import { FormSelect } from "@/components/forms/FormSelect";
import { Button } from "@/components/Button";
import { ErrorBanner } from "@/components/ErrorBanner";
import { useUnsavedChangesGuard, confirmLeaveIfDirty } from "@/lib/forms/useUnsavedChangesGuard";
import { assetTypeLabel } from "@/lib/dashboard/investments";
import type { HoldingRow } from "@/lib/dashboard/investments";
import type { AccountOption } from "@/lib/dashboard/formData";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

interface Props {
  portfolioId: string;
  homeHref: string;
  holdings: HoldingRow[];
  accounts: AccountOption[];
  variant?: "page" | "modal";
  onSuccess?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}

export function InvestmentSellForm({
  portfolioId,
  homeHref,
  holdings,
  accounts,
  variant = "page",
  onSuccess,
  onDirtyChange,
}: Props) {
  const router = useRouter();
  const submittingRef = useRef(false);

  const [holdingKey, setHoldingKey] = useState(holdings[0] ? `${holdings[0].assetSymbol}:${holdings[0].assetType}` : "");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [date, setDate] = useState(todayIso());
  const [note, setNote] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDirty = quantity !== "" || price !== "";
  useUnsavedChangesGuard(isDirty);
  useEffect(() => {
    onDirtyChange?.(isDirty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDirty]);

  const selectedHolding = holdings.find((h) => `${h.assetSymbol}:${h.assetType}` === holdingKey);
  const qtyNum = Number(quantity.replace(",", "."));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (submittingRef.current) return;

    if (!selectedHolding) {
      setError("Satılacak bir varlık seçmelisin.");
      return;
    }
    if (!qtyNum || qtyNum <= 0) {
      setError("Geçerli bir miktar gir.");
      return;
    }
    if (qtyNum > selectedHolding.quantity) {
      setError(`Elinde yalnızca ${selectedHolding.quantity} adet var.`);
      return;
    }
    const priceCents = amountInputToCents(price);
    if (priceCents === null || priceCents <= 0) {
      setError("Geçerli bir birim fiyat gir.");
      return;
    }
    if (!accountId) {
      setError("Bir hesap seçmelisin.");
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    const supabase = createClient();
    const { error: rpcError } = await createInvestmentSell(supabase, {
      p_portfolio_id: portfolioId,
      p_asset_symbol: selectedHolding.assetSymbol,
      p_asset_type: selectedHolding.assetType as never,
      p_quantity: qtyNum,
      p_price_cents: priceCents,
      p_cash_account_id: accountId,
      p_occurred_at: new Date(date + "T12:00:00").toISOString(),
      p_note: note.trim() || null,
    });
    submittingRef.current = false;
    setSubmitting(false);

    if (rpcError) {
      setError(rpcError.message || "Satış kaydedilemedi.");
      return;
    }

    if (variant === "modal") onSuccess?.();
    else router.push(homeHref);
  }

  if (holdings.length === 0) {
    const empty = <p className="pt-6 text-center text-sm text-text-muted">Satılacak bir varlığın yok.</p>;
    if (variant === "modal") return empty;
    return (
      <AppShell variant="subpage" title="Yatırım satışı" backFallbackHref={homeHref}>
        {empty}
      </AppShell>
    );
  }

  const formBody = (
    <>
      <form id="invest-sell-form" onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4 pt-3 pb-4">
        {error ? <ErrorBanner message={error} /> : null}

        <FormSelect
          label="Varlık"
          value={holdingKey}
          onChange={(e) => setHoldingKey(e.target.value)}
          options={holdings.map((h) => ({
            value: `${h.assetSymbol}:${h.assetType}`,
            label: `${h.assetSymbol} · ${assetTypeLabel(h.assetType)} · elinde ${h.quantity} adet`,
          }))}
        />
        <TextField
          label="Satılacak miktar"
          placeholder={selectedHolding ? `En fazla ${selectedHolding.quantity}` : ""}
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          autoFocus
        />
        <AmountInput label="Birim fiyat" value={price} onChange={setPrice} allowNegative={false} />
        <FormSelect
          label="Paranın yatacağı hesap"
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          options={accounts.map((a) => ({ value: a.id, label: a.currency === "TRY" ? a.name : `${a.name} (${a.currency})` }))}
          disabled={accounts.length === 0}
          placeholder={accounts.length === 0 ? "Önce bir hesap eklemelisin" : "Seçiniz"}
        />
        <TextField label="Tarih" type="date" value={date} onChange={(e) => setDate(e.target.value)} max={todayIso()} />
        <TextField label="Not (isteğe bağlı)" value={note} onChange={(e) => setNote(e.target.value)} />
      </form>

      <div className={variant === "modal" ? "sticky bottom-0 border-t border-border bg-bg pt-3" : "sticky bottom-0 border-t border-border bg-bg pb-[max(1rem,env(safe-area-inset-bottom))] pt-3"}>
        <Button type="submit" form="invest-sell-form" loading={submitting}>
          Satışı kaydet
        </Button>
      </div>
    </>
  );

  if (variant === "modal") return formBody;

  return (
    <AppShell variant="subpage" title="Yatırım satışı" backFallbackHref={homeHref} backGuard={() => confirmLeaveIfDirty(isDirty)}>
      {formBody}
    </AppShell>
  );
}
