"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createRecurringPaymentRule } from "@/lib/api/financial-rpc";
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
const FREQUENCY_OPTIONS = [
  { value: "monthly", label: "Her ay" },
  { value: "weekly", label: "Her hafta" },
];
const WEEKDAY_OPTIONS = [
  { value: "1", label: "Pazartesi" },
  { value: "2", label: "Salı" },
  { value: "3", label: "Çarşamba" },
  { value: "4", label: "Perşembe" },
  { value: "5", label: "Cuma" },
  { value: "6", label: "Cumartesi" },
  { value: "0", label: "Pazar" },
];

export function RecurringRuleForm({ bookId, homeHref }: { bookId: string; homeHref: string }) {
  const router = useRouter();
  const submittingRef = useRef(false);

  const [counterpartyName, setCounterpartyName] = useState("");
  const [direction, setDirection] = useState<DebtDirection>("payable");
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState<"monthly" | "weekly">("monthly");
  const [dayOfMonth, setDayOfMonth] = useState("1");
  const [dayOfWeek, setDayOfWeek] = useState("1");
  const [note, setNote] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDirty = counterpartyName !== "" || amount !== "" || note !== "";
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
    const { error: rpcError } = await createRecurringPaymentRule(supabase, {
      p_book_id: bookId,
      p_counterparty_name: trimmedName,
      p_direction: direction,
      p_amount_cents: cents,
      p_frequency: frequency,
      p_day_of_month: frequency === "monthly" ? Number(dayOfMonth) : null,
      p_day_of_week: frequency === "weekly" ? Number(dayOfWeek) : null,
      p_note: note.trim() || null,
    });

    submittingRef.current = false;
    setSubmitting(false);

    if (rpcError) {
      setError(rpcError.message || "Kural oluşturulamadı.");
      return;
    }

    router.refresh();
    router.push(homeHref);
  }

  return (
    <AppShell
      variant="subpage"
      title="Yeni tekrarlayan ödeme"
      backFallbackHref={homeHref}
      backGuard={() => confirmLeaveIfDirty(isDirty)}
    >
      <form id="recurring-form" onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4 pt-3 pb-4">
        {error ? <ErrorBanner message={error} /> : null}

        <FormSelect
          label="Tür"
          value={direction}
          onChange={(e) => setDirection(e.target.value as DebtDirection)}
          options={DIRECTION_OPTIONS}
        />

        <TextField
          label="Kişi/kurum adı"
          placeholder="Örn. Ev sahibi, İnternet faturası"
          required
          autoFocus
          value={counterpartyName}
          onChange={(e) => setCounterpartyName(e.target.value)}
        />

        <AmountInput label="Tutar" value={amount} onChange={setAmount} allowNegative={false} />

        <FormSelect
          label="Sıklık"
          value={frequency}
          onChange={(e) => setFrequency(e.target.value as "monthly" | "weekly")}
          options={FREQUENCY_OPTIONS}
        />

        {frequency === "monthly" ? (
          <FormSelect
            label="Ayın günü"
            value={dayOfMonth}
            onChange={(e) => setDayOfMonth(e.target.value)}
            options={Array.from({ length: 28 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))}
          />
        ) : (
          <FormSelect
            label="Haftanın günü"
            value={dayOfWeek}
            onChange={(e) => setDayOfWeek(e.target.value)}
            options={WEEKDAY_OPTIONS}
          />
        )}

        <TextField
          label="Açıklama (isteğe bağlı)"
          placeholder="Örn. Kira sözleşmesi"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        <div className="rounded-2xl border border-dashed border-border-strong p-3.5 text-xs text-text-muted">
          Bu kural, vadesi geldiğinde otomatik olarak yeni bir borç/alacak kaydı oluşturur. Otomatik üretim,
          sunucuda düzenli çalışan bir zamanlayıcı gerektirir — bu turda yalnızca alt yapı kuruldu.
        </div>
      </form>

      <div className="sticky bottom-0 border-t border-border bg-bg pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        <Button type="submit" form="recurring-form" loading={submitting}>
          Kuralı oluştur
        </Button>
      </div>
    </AppShell>
  );
}
