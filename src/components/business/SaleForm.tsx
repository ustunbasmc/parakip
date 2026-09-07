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
  { value: "cash", label: "Nakit" },
  { value: "bank", label: "Banka" },
  { value: "card", label: "Kart" },
  { value: "credit", label: "Veresiye" },
];
const METHOD_TO_ACCOUNT_TYPE: Record<string, string> = { cash: "cash", bank: "bank", card: "pos" };

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * "Satış" işlemi, mevcut ledger çekirdeğini DEĞİŞTİRMEZ: peşin satış
 * create_simple_transaction (p_type='income') ile GERÇEK bir gelir
 * hareketi oluşturur; veresiye satış create_debt_v2 (direction=
 * 'receivable') ile müşteriden alacak oluşturur. SINIFLANDIRMA artık
 * NOT ÖNEKİYLE DEĞİL, GÜVENİLİR bir sistem alanıyla yapılır:
 * transactions.metadata / debts.metadata → {"business_kind":"sale"}.
 * `note` alanı SALT kullanıcının kendi açıklamasıdır, hiçbir
 * sınıflandırma önekiyle KARIŞTIRILMAZ.
 */
export function SaleForm({
  bookId,
  homeHref,
  accounts,
  categories,
  customers,
  variant = "page",
  onSuccess,
  onDirtyChange,
}: {
  bookId: string;
  homeHref: string;
  accounts: AccountOption[];
  categories: CategoryOption[];
  customers: PartyRow[];
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
  const [customerId, setCustomerId] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [note, setNote] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDirty = amount !== "" || description !== "" || note !== "";
  useUnsavedChangesGuard(isDirty);
  useEffect(() => {
    onDirtyChange?.(isDirty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDirty]);

  const isCredit = method === "credit";
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
      setError("Geçerli bir satış tutarı gir.");
      return;
    }
    if (!isCredit && !accountId) {
      setError("Bir hesap seçmelisin.");
      return;
    }
    // "Veresiye satışta müşteri seçimi zorunlu hâle getirilebilir" — burada
    // müşteri listesi varsa (yani işletme en az bir müşteri kaydetmişse)
    // veresiye satışta seçim zorunlu tutulur; hiç müşteri yoksa akışı
    // TIKAMAMAK için serbest bırakılır (kullanıcı önce Müşteriler
    // ekranından ekleyebilir).
    if (isCredit && customers.length > 0 && !customerId) {
      setError("Veresiye satış için bir müşteri seçmelisin.");
      return;
    }

    const customerName = customers.find((c) => c.id === customerId)?.name;
    const noteText = note.trim() || null;

    submittingRef.current = true;
    setSubmitting(true);
    const supabase = createClient();

    if (isCredit) {
      const { error: rpcError } = await createDebtV2(supabase, {
        p_book_id: bookId,
        p_counterparty_name: customerName || "Müşteri",
        p_direction: "receivable",
        p_principal_cents: cents,
        p_due_date: null,
        p_note: noteText,
        p_metadata: { business_kind: "sale", description: description.trim() || "Satış" },
        p_customer_id: customerId || null,
      });
      submittingRef.current = false;
      setSubmitting(false);
      if (rpcError) {
        setError(rpcError.message || "Satış kaydedilemedi.");
        return;
      }
    } else {
      const { error: rpcError } = await createSimpleTransaction(supabase, {
        p_book_id: bookId,
        p_account_id: accountId,
        p_type: "income",
        p_amount_cents: cents,
        p_category_id: categoryId || null,
        p_note: noteText,
        p_occurred_at: new Date(date + "T12:00:00").toISOString(),
        p_metadata: { business_kind: "sale", description: description.trim() || "Satış" },
      });
      submittingRef.current = false;
      setSubmitting(false);
      if (rpcError) {
        setError(rpcError.message || "Satış kaydedilemedi.");
        return;
      }
    }

    if (variant === "modal") onSuccess?.();
    else router.push(homeHref);
  }

  const formBody = (
    <>
      <form id="sale-form" onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4 pt-3 pb-4">
        {error ? <ErrorBanner message={error} /> : null}

        <AmountInput label="Satış tutarı" value={amount} onChange={setAmount} allowNegative={false} autoFocus />

        <TextField label="Tarih" type="date" value={date} onChange={(e) => setDate(e.target.value)} max={todayIso()} />

        <FormSelect label="Ödeme yöntemi" value={method} onChange={(e) => setMethod(e.target.value)} options={PAYMENT_METHODS} />

        {isCredit ? (
          <FormSelect
            label={customers.length > 0 ? "Müşteri" : "Müşteri (kayıtlı müşteri yok)"}
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            options={customers.map((c) => ({ value: c.id, label: c.name }))}
            placeholder="Seçiniz"
            disabled={customers.length === 0}
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
          placeholder="Örn. 3 adet kahve"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <FormSelect
          label="Kategori (isteğe bağlı)"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          options={[{ value: "", label: "Kategorisiz" }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
        />

        <TextField label="Not (isteğe bağlı)" value={note} onChange={(e) => setNote(e.target.value)} />

        {isCredit ? (
          <p className="rounded-2xl bg-surface-muted p-3.5 text-xs text-text-muted">
            Veresiye satış, müşteri adına bir alacak kaydı oluşturur ve hesap bakiyeni HENÜZ ARTIRMAZ. Tahsilat
            yapıldığında Borçlar ekranından işaretleyebilirsin.
          </p>
        ) : null}
      </form>

      <div className={variant === "modal" ? "sticky bottom-0 border-t border-border bg-bg pt-3" : "sticky bottom-0 border-t border-border bg-bg pb-[max(1rem,env(safe-area-inset-bottom))] pt-3"}>
        <Button type="submit" form="sale-form" loading={submitting}>
          Satışı kaydet
        </Button>
      </div>
    </>
  );

  if (variant === "modal") return formBody;

  return (
    <AppShell
      variant="subpage"
      title="Satış ekle"
      backFallbackHref={homeHref}
      backGuard={() => confirmLeaveIfDirty(isDirty)}
    >
      {formBody}
    </AppShell>
  );
}
