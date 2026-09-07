"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createInvestmentBuy, type AssetType } from "@/lib/api/financial-rpc";
import { amountInputToCents } from "@/lib/format/amount";
import { AppShell } from "@/components/AppShell";
import { TextField } from "@/components/TextField";
import { AmountInput } from "@/components/AmountInput";
import { FormSelect } from "@/components/forms/FormSelect";
import { Button } from "@/components/Button";
import { ErrorBanner } from "@/components/ErrorBanner";
import { useUnsavedChangesGuard, confirmLeaveIfDirty } from "@/lib/forms/useUnsavedChangesGuard";
import type { AccountOption } from "@/lib/dashboard/formData";

const ASSET_TYPES: { value: AssetType; label: string }[] = [
  { value: "bist", label: "BIST Hisse" },
  { value: "us_stock", label: "ABD Hissesi" },
  { value: "gold", label: "Altın" },
  { value: "fx", label: "Döviz" },
  { value: "crypto", label: "Kripto" },
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * v1 KAPSAM SINIRI: varlığın para birimi, seçilen nakit hesabın para
 * birimiyle AYNI kabul edilir (çoklu para birimi/FX alanları bu formda
 * KULLANILMAZ) — RPC bunu zaten destekliyor ama arayüz karmaşıklığını
 * bu turda sınırlı tutmak için basit, tek para birimli akış sunulur.
 */
export function InvestmentBuyForm({
  portfolioId,
  homeHref,
  accounts,
  variant = "page",
  onSuccess,
  onDirtyChange,
}: {
  portfolioId: string;
  homeHref: string;
  accounts: AccountOption[];
  variant?: "page" | "modal";
  onSuccess?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const router = useRouter();
  const submittingRef = useRef(false);

  const [symbol, setSymbol] = useState("");
  const [assetType, setAssetType] = useState<AssetType>("bist");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [date, setDate] = useState(todayIso());
  const [note, setNote] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDirty = symbol !== "" || quantity !== "" || price !== "";
  useUnsavedChangesGuard(isDirty);
  useEffect(() => {
    onDirtyChange?.(isDirty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDirty]);

  const selectedAccount = accounts.find((a) => a.id === accountId);
  const qtyNum = Number(quantity.replace(",", "."));
  const priceCents = amountInputToCents(price);
  const totalCents = qtyNum > 0 && priceCents ? Math.round(qtyNum * priceCents) : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (submittingRef.current) return;

    if (!symbol.trim()) {
      setError("Bir sembol/varlık adı gir.");
      return;
    }
    if (!qtyNum || qtyNum <= 0) {
      setError("Geçerli bir miktar gir.");
      return;
    }
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
    const { error: rpcError } = await createInvestmentBuy(supabase, {
      p_portfolio_id: portfolioId,
      p_asset_symbol: symbol.trim().toUpperCase(),
      p_asset_type: assetType,
      p_quantity: qtyNum,
      p_price_cents: priceCents,
      p_cash_account_id: accountId,
      p_currency: selectedAccount?.currency ?? "TRY",
      p_occurred_at: new Date(date + "T12:00:00").toISOString(),
      p_note: note.trim() || null,
    });
    submittingRef.current = false;
    setSubmitting(false);

    if (rpcError) {
      setError(rpcError.message || "Alış kaydedilemedi.");
      return;
    }

    if (variant === "modal") onSuccess?.();
    else router.push(homeHref);
  }

  const formBody = (
    <>
      <form id="invest-buy-form" onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4 pt-3 pb-4">
        {error ? <ErrorBanner message={error} /> : null}

        <FormSelect label="Varlık türü" value={assetType} onChange={(e) => setAssetType(e.target.value as AssetType)} options={ASSET_TYPES} />
        <TextField label="Sembol" placeholder="Örn. THYAO, AAPL, ALTIN" value={symbol} onChange={(e) => setSymbol(e.target.value)} autoFocus />
        {assetType === "fx" || assetType === "crypto" ? (
          <p className="-mt-2 text-xs text-text-muted">
            Güncel piyasa fiyatı yalnızca <strong>USD</strong>, <strong>EUR</strong> (döviz) ve{" "}
            <strong>BTC</strong>, <strong>ETH</strong> (kripto) sembolleri için otomatik güncellenir — başka bir
            sembol girersen yalnızca maliyet bazlı takip edilir.
          </p>
        ) : null}
        <TextField label="Miktar" placeholder="Örn. 10 veya 0.5" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        <AmountInput label="Birim fiyat" value={price} onChange={setPrice} allowNegative={false} />

        {totalCents !== null ? (
          <p className="text-xs text-text-muted">Toplam tutar: {(totalCents / 100).toFixed(2)} {selectedAccount?.currency ?? "TRY"}</p>
        ) : null}

        <FormSelect
          label="Ödeme hesabı"
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
        <Button type="submit" form="invest-buy-form" loading={submitting}>
          Alışı kaydet
        </Button>
      </div>
    </>
  );

  if (variant === "modal") return formBody;

  return (
    <AppShell variant="subpage" title="Yatırım alışı" backFallbackHref={homeHref} backGuard={() => confirmLeaveIfDirty(isDirty)}>
      {formBody}
    </AppShell>
  );
}
