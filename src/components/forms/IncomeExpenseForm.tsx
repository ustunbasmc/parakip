"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createSimpleTransaction, editSimpleTransaction } from "@/lib/api/financial-rpc";
import { amountInputToCents, formatCentsAsCurrency } from "@/lib/format/amount";
import { AppShell } from "@/components/AppShell";
import { AmountInput } from "@/components/AmountInput";
import { FormSelect } from "@/components/forms/FormSelect";
import { TextField } from "@/components/TextField";
import { Button } from "@/components/Button";
import { ErrorBanner } from "@/components/ErrorBanner";
import { FormSuccessState } from "@/components/forms/FormSuccessState";
import { useUnsavedChangesGuard, confirmLeaveIfDirty } from "@/lib/forms/useUnsavedChangesGuard";
import type { AccountOption, CategoryOption } from "@/lib/dashboard/formData";

interface Props {
  kind: "income" | "expense";
  bookId: string;
  homeHref: string;
  accounts: AccountOption[];
  categories: CategoryOption[];
  /** İşletme "Masraf ekle" akışından geliyorsa 'expense' — güvenilir sistem
   * sınıflandırması için transactions.metadata'ya yazılır (bkz. business.ts). */
  businessKind?: "expense";
  /** "page" (varsayılan): kendi AppShell'i + geri tuşu + router.push ile
   * yönlendirme. "modal": Modal.tsx İÇİNDE render edilir — AppShell
   * SARMALAYICI YOKTUR, başarı sonrası sayfa değiştirmek yerine
   * onSuccess() çağrılır (Modal'ı kapatmak ve listeyi yenilemek çağıran
   * tarafın sorumluluğundadır). Aynı form mantığı, aynı RPC — kod
   * tekrarı YOK, yalnızca DIŞ ÇERÇEVE değişir. */
  variant?: "page" | "modal";
  onSuccess?: () => void;
  /** Modal modunda, kapanmadan önce "kaydedilmemiş veri var mı" kontrolü için. */
  onDirtyChange?: (dirty: boolean) => void;
  /**
   * "create" (varsayılan): yeni işlem oluşturur (create_simple_transaction).
   * "edit": mevcut bir işlemi GÜVENLİ şekilde düzenler (edit_simple_transaction
   * — eski işlemi iptal edip yenisini oluşturur, bkz. migration 0059).
   * Bu modda `editTransactionId` ve `initialValues` ZORUNLUDUR.
   */
  mode?: "create" | "edit";
  editTransactionId?: string;
  initialValues?: {
    amountCents: number; // işaretli (income>0, expense<0) — mevcut kayıttaki HAM değer
    accountId: string;
    categoryId: string | null;
    note: string | null;
    occurredAt: string; // ISO
  };
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function friendlyRpcError(message: string | undefined): string {
  if (!message) return "Kayıt oluşturulamadı. Lütfen tekrar dene.";
  if (message.toLowerCase().includes("fetch")) {
    return "Bağlantı sorunu oluştu. İnternet bağlantını kontrol edip tekrar dene.";
  }
  // Kendi RPC fonksiyonlarımız zaten Türkçe hata fırlatır (ör. "Bu defter
  // icin yetkiniz yok") — burada ek bir çeviri gerekmez, doğrudan gösterilir.
  return message;
}

/**
 * Gelir VE gider formu — aynı bileşen, `kind` ile ayrışıyor (RPC çağrısı
 * hariç neredeyse tüm mantık ortak, kod tekrarını önlemek için).
 *
 * TUTAR İŞARETİ NOTU: create_simple_transaction sunucu tarafında income
 * için pozitif, expense için negatif amount_cents ZORUNLU kılıyor
 * (bkz. migration 0011). Kullanıcı deneyimini basitleştirmek için gider
 * alanında hem "50" hem "-50" yazmak KABUL EDİLİR — ikisi de aynı anlama
 * gelir (50 TL harcama); mutlak değer alınıp RPC'ye her zaman NEGATİF
 * gönderilir. Gelir alanında ise eksi işareti YİNE GEÇERSİZ sayılır
 * (muhtemel bir yazım hatasını yakalamak için) — bkz. AmountInput'un
 * invalidMinusUsage davranışı.
 */
export function IncomeExpenseForm({
  kind,
  bookId,
  homeHref,
  accounts,
  categories,
  businessKind,
  variant = "page",
  onSuccess,
  onDirtyChange,
  mode = "create",
  editTransactionId,
  initialValues,
}: Props) {
  const router = useRouter();
  const submittingRef = useRef(false);

  const [amount, setAmount] = useState(
    initialValues ? (Math.abs(initialValues.amountCents) / 100).toString().replace(".", ",") : ""
  );
  const [accountId, setAccountId] = useState(initialValues?.accountId ?? accounts[0]?.id ?? "");
  const [categoryId, setCategoryId] = useState(initialValues?.categoryId ?? "");
  const [date, setDate] = useState(initialValues ? initialValues.occurredAt.slice(0, 10) : todayIso());
  const [note, setNote] = useState(initialValues?.note ?? "");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const isDirty =
    mode === "edit" && initialValues
      ? amount !== (Math.abs(initialValues.amountCents) / 100).toString().replace(".", ",") ||
        accountId !== initialValues.accountId ||
        categoryId !== (initialValues.categoryId ?? "") ||
        date !== initialValues.occurredAt.slice(0, 10) ||
        note !== (initialValues.note ?? "")
      : amount !== "" || note !== "" || categoryId !== "" || date !== todayIso();
  useUnsavedChangesGuard(isDirty && !success);
  useEffect(() => {
    onDirtyChange?.(isDirty && !success);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDirty, success]);

  const selectedAccount = accounts.find((a) => a.id === accountId);
  const cents = amountInputToCents(amount);

  const title = mode === "edit" ? (kind === "income" ? "Geliri düzenle" : "Gideri düzenle") : kind === "income" ? "Gelir ekle" : "Gider ekle";
  const label = kind === "income" ? "Gelir tutarı" : "Gider tutarı";

  const summary = useMemo(() => {
    if (cents === null || cents === 0 || !selectedAccount) return null;
    const signedCents = kind === "income" ? Math.abs(cents) : -Math.abs(cents);
    return {
      amountLabel: formatCentsAsCurrency(signedCents, selectedAccount.currency),
      accountName: selectedAccount.name,
      categoryName: categories.find((c) => c.id === categoryId)?.name ?? "Kategorisiz",
      dateLabel: new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric" }).format(
        new Date(date + "T00:00:00")
      ),
      note: note.trim(),
    };
  }, [cents, selectedAccount, kind, categories, categoryId, date, note]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (submittingRef.current) return; // çift tıklama koruması (state güncellemesini beklemeden)

    if (!accountId) {
      setError("Bir hesap seçmelisin.");
      return;
    }
    if (cents === null || cents === 0) {
      setError("Geçerli bir tutar gir.");
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);

    const signedCents = kind === "income" ? Math.abs(cents) : -Math.abs(cents);
    const supabase = createClient();

    const { error: rpcError } =
      mode === "edit" && editTransactionId
        ? await editSimpleTransaction(supabase, {
            p_old_transaction_id: editTransactionId,
            p_account_id: accountId,
            p_type: kind,
            p_amount_cents: signedCents,
            p_category_id: categoryId || null,
            p_note: note.trim() || null,
            p_occurred_at: new Date(date + "T12:00:00").toISOString(),
            p_metadata: businessKind ? { business_kind: businessKind } : undefined,
          })
        : await createSimpleTransaction(supabase, {
            p_book_id: bookId,
            p_account_id: accountId,
            p_type: kind,
            p_amount_cents: signedCents,
            p_category_id: categoryId || null,
            p_note: note.trim() || null,
            p_occurred_at: new Date(date + "T12:00:00").toISOString(),
            p_metadata: businessKind ? { business_kind: businessKind } : undefined,
          });

    submittingRef.current = false;
    setSubmitting(false);

    if (rpcError) {
      setError(friendlyRpcError(rpcError.message));
      return;
    }

    setSuccess(true);
    router.refresh(); // dashboard verisini yenile
    if (variant === "modal") {
      setTimeout(() => onSuccess?.(), 900);
    } else {
      setTimeout(() => router.push(homeHref), 900);
    }
  }

  if (success && summary) {
    const successBody = (
      <FormSuccessState
        message={`${summary.amountLabel} · ${summary.accountName}`}
        title={mode === "edit" ? "Güncellendi" : undefined}
      />
    );
    if (variant === "modal") return successBody;
    return (
      <AppShell variant="subpage" title={title} backFallbackHref={homeHref}>
        {successBody}
      </AppShell>
    );
  }

  const formBody = (
    <>
      <form
        id="income-expense-form"
        onSubmit={handleSubmit}
        className="flex flex-1 flex-col gap-4 pt-3 pb-4"
      >
        {error ? <ErrorBanner message={error} /> : null}

        <AmountInput
          label={label}
          value={amount}
          onChange={setAmount}
          allowNegative={kind === "expense"}
          autoFocus
        />

        <FormSelect
          label="Hesap"
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          options={accounts.map((a) => ({
            value: a.id,
            label: a.currency === "TRY" ? a.name : `${a.name} (${a.currency})`,
          }))}
          placeholder={accounts.length === 0 ? "Önce bir hesap eklemelisin" : undefined}
          disabled={accounts.length === 0}
        />

        <FormSelect
          label="Kategori (isteğe bağlı)"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          options={[{ value: "", label: "Kategorisiz" }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
        />

        <TextField label="Tarih" type="date" value={date} onChange={(e) => setDate(e.target.value)} max={todayIso()} />

        <TextField
          label="Açıklama (isteğe bağlı)"
          placeholder="Örn. Market alışverişi"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        {summary ? (
          <div className="mt-1 rounded-2xl border border-border bg-surface-muted p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Özet</p>
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-text-secondary">{summary.accountName}</span>
              <span
                className={`text-xl font-bold tabular-nums ${
                  kind === "income" ? "text-success" : "text-danger"
                }`}
              >
                {summary.amountLabel}
              </span>
            </div>
            <p className="mt-1 text-xs text-text-muted">
              {summary.categoryName} · {summary.dateLabel}
              {summary.note ? ` · ${summary.note}` : ""}
            </p>
          </div>
        ) : null}
      </form>

      <div className={variant === "modal" ? "sticky bottom-0 border-t border-border bg-bg pt-3" : "sticky bottom-0 border-t border-border bg-bg pb-[max(1rem,env(safe-area-inset-bottom))] pt-3"}>
        <Button type="submit" form="income-expense-form" loading={submitting} disabled={accounts.length === 0}>
          {mode === "edit" ? "Güncelle" : "Kaydet"}
        </Button>
      </div>
    </>
  );

  if (variant === "modal") return formBody;

  return (
    <AppShell
      variant="subpage"
      title={title}
      backFallbackHref={homeHref}
      backGuard={() => confirmLeaveIfDirty(isDirty)}
    >
      {formBody}
    </AppShell>
  );
}
