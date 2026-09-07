"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createSimpleTransaction, createDebtV2 } from "@/lib/api/financial-rpc";
import { amountInputToCents } from "@/lib/format/amount";
import { AppShell } from "@/components/AppShell";
import { TextField } from "@/components/TextField";
import { AmountInput } from "@/components/AmountInput";
import { FormSelect } from "@/components/forms/FormSelect";
import { Button } from "@/components/Button";
import { ErrorBanner } from "@/components/ErrorBanner";
import { useUnsavedChangesGuard, confirmLeaveIfDirty } from "@/lib/forms/useUnsavedChangesGuard";
import type { AccountOption, CategoryOption } from "@/lib/dashboard/formData";
import type { PartyRow } from "@/lib/dashboard/customers";

const PAYMENT_METHODS = [
  { value: "cash", label: "Nakit (peşin)" },
  { value: "bank", label: "Banka (peşin)" },
  { value: "card", label: "Kart (peşin)" },
  { value: "credit", label: "Vadeli (borç)" },
];
const METHOD_TO_ACCOUNT_TYPE: Record<string, string> = { cash: "cash", bank: "bank", card: "pos" };

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * "Alış", mevcut ledger çekirdeğini DEĞİŞTİRMEZ: peşin alış
 * create_simple_transaction (p_type='expense') ile GERÇEK bir gider
 * hareketi oluşturur; vadeli alış create_debt_v2 (direction='payable')
 * ile tedarikçiye borç oluşturur. Sınıflandırma metadata ile yapılır
 * (business_kind='purchase') — "Masraf" (kira/elektrik/personel gibi
 * tedarikçisiz genel giderler) AYRI bir akıştır (bkz. QuickActions'taki
 * "Masraf ekle" → mevcut genel Gider formu, business_kind='expense').
 */
export function PurchaseForm({
  bookId,
  homeHref,
  accounts,
  categories,
  suppliers,
  variant = "page",
  onSuccess,
  onDirtyChange,
}: {
  bookId: string;
  homeHref: string;
  accounts: AccountOption[];
  categories: CategoryOption[];
  suppliers: PartyRow[];
  variant?: "page" | "modal";
  onSuccess?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const router = useRouter();
  const submittingRef = useRef(false);

  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayIso());
  const [method, setMethod] = useState("cash");
  const [accountId, setAccountId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [note, setNote] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isCredit = method === "credit";
  const isDirty = amount !== "" || description !== "" || note !== "";
  useUnsavedChangesGuard(isDirty);
  useEffect(() => {
    onDirtyChange?.(isDirty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDirty]);

  const suggestedType = METHOD_TO_ACCOUNT_TYPE[method];
  const filteredAccounts = suggestedType ? accounts.filter((a) => a.type === suggestedType) : accounts;
  const accountOptions = (filteredAccounts.length > 0 ? filteredAccounts : accounts).map((a) => ({
    value: a.id,
    label: a.currency === "TRY" ? a.name : `${a.name} (${a.currency})`,
  }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (submittingRef.current) return;

    const cents = amountInputToCents(amount);
    if (cents === null || cents <= 0) {
      setError("Geçerli bir alış tutarı gir.");
      return;
    }
    if (!isCredit && !accountId) {
      setError("Bir hesap seçmelisin.");
      return;
    }
    if (isCredit && suppliers.length > 0 && !supplierId) {
      setError("Vadeli alış için bir tedarikçi seçmelisin.");
      return;
    }

    const supplierName = suppliers.find((s) => s.id === supplierId)?.name;
    const noteText = note.trim() || null;

    submittingRef.current = true;
    setSubmitting(true);
    const supabase = createClient();

    if (isCredit) {
      const { error: rpcError } = await createDebtV2(supabase, {
        p_book_id: bookId,
        p_counterparty_name: supplierName || "Tedarikçi",
        p_direction: "payable",
        p_principal_cents: cents,
        p_due_date: null,
        p_note: noteText,
        p_metadata: { business_kind: "purchase", description: description.trim() || "Alış" },
        p_supplier_id: supplierId || null,
      });
      submittingRef.current = false;
      setSubmitting(false);
      if (rpcError) {
        setError(rpcError.message || "Alış kaydedilemedi.");
        return;
      }
    } else {
      const { error: rpcError } = await createSimpleTransaction(supabase, {
        p_book_id: bookId,
        p_account_id: accountId,
        p_type: "expense",
        p_amount_cents: -cents,
        p_category_id: categoryId || null,
        p_note: noteText,
        p_occurred_at: new Date(date + "T12:00:00").toISOString(),
        p_metadata: { business_kind: "purchase", description: description.trim() || "Alış" },
      });
      submittingRef.current = false;
      setSubmitting(false);
      if (rpcError) {
        setError(rpcError.message || "Alış kaydedilemedi.");
        return;
      }
    }

    if (variant === "modal") onSuccess?.();
    else router.push(homeHref);
  }

  const formBody = (
    <>
      <form id="purchase-form" onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4 pt-3 pb-4">
        {error ? <ErrorBanner message={error} /> : null}

        <AmountInput label="Alış tutarı" value={amount} onChange={setAmount} allowNegative={false} autoFocus />

        <TextField label="Tarih" type="date" value={date} onChange={(e) => setDate(e.target.value)} max={todayIso()} />

        <FormSelect label="Ödeme yöntemi" value={method} onChange={(e) => setMethod(e.target.value)} options={PAYMENT_METHODS} />

        {isCredit ? (
          <FormSelect
            label={suppliers.length > 0 ? "Tedarikçi" : "Tedarikçi (kayıtlı tedarikçi yok)"}
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
            placeholder="Seçiniz"
            disabled={suppliers.length === 0}
          />
        ) : (
          <FormSelect
            label="Hesap"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            options={accountOptions}
            placeholder={accountOptions.length === 0 ? "Önce bir hesap eklemelisin" : "Seçiniz"}
            disabled={accountOptions.length === 0}
          />
        )}

        <TextField
          label="Ürün/hizmet açıklaması"
          placeholder="Örn. Kahve çekirdeği (10kg)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <FormSelect
          label="Gider kategorisi (isteğe bağlı)"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          options={[{ value: "", label: "Kategorisiz" }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
        />

        <TextField label="Not (isteğe bağlı)" value={note} onChange={(e) => setNote(e.target.value)} />

        {isCredit ? (
          <p className="rounded-2xl bg-surface-muted p-3.5 text-xs text-text-muted">
            Vadeli alış, tedarikçi adına bir borç kaydı oluşturur. Ödeme yaptığında Borçlar ekranından
            işaretleyebilirsin.
          </p>
        ) : null}
      </form>

      <div className={variant === "modal" ? "sticky bottom-0 border-t border-border bg-bg pt-3" : "sticky bottom-0 border-t border-border bg-bg pb-[max(1rem,env(safe-area-inset-bottom))] pt-3"}>
        <Button type="submit" form="purchase-form" loading={submitting}>
          Alışı kaydet
        </Button>
      </div>
    </>
  );

  if (variant === "modal") return formBody;

  return (
    <AppShell
      variant="subpage"
      title="Alış ekle"
      backFallbackHref={homeHref}
      backGuard={() => confirmLeaveIfDirty(isDirty)}
    >
      {formBody}
    </AppShell>
  );
}
