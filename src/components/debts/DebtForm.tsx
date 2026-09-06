"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createDebt } from "@/lib/api/financial-rpc";
import { amountInputToCents } from "@/lib/format/amount";
import { AppShell } from "@/components/AppShell";
import { TextField } from "@/components/TextField";
import { AmountInput } from "@/components/AmountInput";
import { FormSelect } from "@/components/forms/FormSelect";
import { Button } from "@/components/Button";
import { ErrorBanner } from "@/components/ErrorBanner";
import { useUnsavedChangesGuard, confirmLeaveIfDirty } from "@/lib/forms/useUnsavedChangesGuard";
import type { DebtDirection } from "@/lib/dashboard/debts";

const DIRECTION_OPTIONS = [
  { value: "payable", label: "Borç (ödeyeceğim)" },
  { value: "receivable", label: "Alacak (tahsil edeceğim)" },
];

export function DebtForm({ bookId, homeHref }: { bookId: string; homeHref: string }) {
  const router = useRouter();
  const submittingRef = useRef(false);

  const [counterpartyName, setCounterpartyName] = useState("");
  const [direction, setDirection] = useState<DebtDirection>("payable");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [note, setNote] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDirty = counterpartyName !== "" || amount !== "" || dueDate !== "" || note !== "";
  useUnsavedChangesGuard(isDirty);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (submittingRef.current) return;

    const trimmedName = counterpartyName.trim();
    if (!trimmedName) {
      setError("Kişi/kurum adı boş olamaz.");
      return;
    }

    const cents = amountInputToCents(amount);
    if (cents === null || cents <= 0) {
      setError("Geçerli bir tutar gir.");
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);

    const supabase = createClient();
    const { error: rpcError } = await createDebt(supabase, {
      p_book_id: bookId,
      p_counterparty_name: trimmedName,
      p_direction: direction,
      p_principal_cents: cents,
      p_due_date: dueDate || null,
      p_note: note.trim() || null,
    });

    submittingRef.current = false;
    setSubmitting(false);

    if (rpcError) {
      setError(rpcError.message || "Kayıt oluşturulamadı. Lütfen tekrar dene.");
      return;
    }

    router.refresh();
    router.push(homeHref);
  }

  return (
    <AppShell
      variant="subpage"
      title="Yeni borç/alacak"
      backFallbackHref={homeHref}
      backGuard={() => confirmLeaveIfDirty(isDirty)}
    >
      <form id="debt-form" onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4 pt-3 pb-4">
        {error ? <ErrorBanner message={error} /> : null}

        <FormSelect
          label="Tür"
          value={direction}
          onChange={(e) => setDirection(e.target.value as DebtDirection)}
          options={DIRECTION_OPTIONS}
        />

        <TextField
          label="Kişi/kurum adı"
          placeholder="Örn. Ahmet Yılmaz"
          required
          autoFocus
          value={counterpartyName}
          onChange={(e) => setCounterpartyName(e.target.value)}
        />

        <AmountInput label="Tutar" value={amount} onChange={setAmount} allowNegative={false} />

        <TextField
          label="Vade tarihi (isteğe bağlı)"
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />

        <TextField
          label="Açıklama (isteğe bağlı)"
          placeholder="Örn. Kırtasiye borcu"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </form>

      <div className="sticky bottom-0 border-t border-border bg-bg pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        <Button type="submit" form="debt-form" loading={submitting}>
          Kaydet
        </Button>
      </div>
    </AppShell>
  );
}
