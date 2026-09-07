"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createSimpleTransaction, createDebtPayment } from "@/lib/api/financial-rpc";
import { amountInputToCents } from "@/lib/format/amount";
import { AmountInput } from "@/components/AmountInput";
import { TextField } from "@/components/TextField";
import { FormSelect } from "@/components/forms/FormSelect";
import { Button } from "@/components/Button";
import { ErrorBanner } from "@/components/ErrorBanner";
import type { DebtDirection } from "@/lib/dashboard/debts";
import type { AccountOption } from "@/lib/dashboard/formData";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

interface Props {
  debtId: string;
  bookId: string;
  direction: DebtDirection;
  remainingCents: number;
  accounts: AccountOption[];
  onDone: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}

/**
 * "Hesap hareketi entegrasyonu": ödeme, isteğe bağlı olarak GERÇEK bir
 * hesap hareketiyle ilişkilendirilebilir. Bu durumda ÖNCE
 * create_simple_transaction() ile gerçek income/expense kaydı oluşturulur
 * (yön debt.direction'a göre otomatik belirlenir: payable→expense,
 * receivable→income), SONRA dönen işlemin entry id'si create_debt_payment()'a
 * verilir — veritabanı bu ikisinin tutar/yönünün TAM eşleştiğini zaten
 * doğrular (bkz. migration 0018). "Harici/manuel" seçilirse hiçbir hesap
 * hareketi oluşturulmaz, yalnızca borç kaydı düşer.
 */
export function AddPaymentForm({ debtId, bookId, direction, remainingCents, accounts, onDone, onDirtyChange }: Props) {
  const router = useRouter();
  const submittingRef = useRef(false);

  const [linkToAccount, setLinkToAccount] = useState(accounts.length > 0);
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [paidAt, setPaidAt] = useState(todayIso());

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDirty = amount !== "";
  useEffect(() => {
    onDirtyChange?.(isDirty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDirty]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (submittingRef.current) return;

    const cents = amountInputToCents(amount);
    if (cents === null || cents <= 0) {
      setError("Geçerli bir tutar gir.");
      return;
    }
    if (cents > remainingCents) {
      setError("Ödeme tutarı kalan tutardan fazla olamaz.");
      return;
    }
    if (linkToAccount && !accountId) {
      setError("Bir hesap seçmelisin.");
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);

    const supabase = createClient();
    let entryId: string | null = null;

    if (linkToAccount) {
      const signedCents = direction === "payable" ? -cents : cents;
      const { data: txId, error: txError } = await createSimpleTransaction(supabase, {
        p_book_id: bookId,
        p_account_id: accountId,
        p_type: direction === "payable" ? "expense" : "income",
        p_amount_cents: signedCents,
        p_note: "Borç/alacak ödemesi",
        p_occurred_at: new Date(paidAt + "T12:00:00").toISOString(),
      });

      if (txError || !txId) {
        submittingRef.current = false;
        setSubmitting(false);
        setError(txError?.message || "Hesap hareketi oluşturulamadı.");
        return;
      }

      const { data: entryRow, error: entryError } = await supabase
        .from("transaction_entries")
        .select("id")
        .eq("transaction_id", txId)
        .maybeSingle();

      if (entryError || !entryRow) {
        submittingRef.current = false;
        setSubmitting(false);
        setError("Hesap hareketi oluşturuldu ama ilişkilendirilemedi. Lütfen destek ile iletişime geç.");
        return;
      }
      entryId = entryRow.id;
    }

    const { error: paymentError } = await createDebtPayment(supabase, {
      p_debt_id: debtId,
      p_amount_cents: cents,
      p_paid_at: new Date(paidAt + "T12:00:00").toISOString(),
      p_transaction_entry_id: entryId,
    });

    submittingRef.current = false;
    setSubmitting(false);

    if (paymentError) {
      setError(paymentError.message || "Ödeme kaydedilemedi.");
      return;
    }

    router.refresh();
    onDone();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {error ? <ErrorBanner message={error} /> : null}

      {accounts.length > 0 ? (
        <div className="flex gap-1 rounded-full bg-surface p-1">
          <button
            type="button"
            onClick={() => setLinkToAccount(true)}
            className={`flex-1 rounded-full py-1.5 text-xs font-semibold ${linkToAccount ? "bg-accent text-text-on-accent" : "text-text-secondary"}`}
          >
            Hesaptan {direction === "payable" ? "öde" : "tahsil et"}
          </button>
          <button
            type="button"
            onClick={() => setLinkToAccount(false)}
            className={`flex-1 rounded-full py-1.5 text-xs font-semibold ${!linkToAccount ? "bg-accent text-text-on-accent" : "text-text-secondary"}`}
          >
            Harici/manuel
          </button>
        </div>
      ) : null}

      {linkToAccount ? (
        <FormSelect
          label="Hesap"
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          options={accounts.map((a) => ({ value: a.id, label: a.currency === "TRY" ? a.name : `${a.name} (${a.currency})` }))}
        />
      ) : (
        <p className="text-xs text-text-muted">
          Bu ödeme hiçbir hesap hareketiyle ilişkilendirilmeyecek (ör. elden nakit, uygulama dışı havale).
        </p>
      )}

      <AmountInput label="Tutar" value={amount} onChange={setAmount} allowNegative={false} />
      <TextField label="Tarih" type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} max={todayIso()} />

      <Button type="submit" loading={submitting}>
        Ödemeyi kaydet
      </Button>
    </form>
  );
}
