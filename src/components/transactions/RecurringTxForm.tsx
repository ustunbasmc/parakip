"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { amountInputToCents } from "@/lib/format/amount";
import { createRecurringTxRule, WEEKDAY_LABELS } from "@/lib/dashboard/recurringTransactions";
import { AppShell } from "@/components/AppShell";
import { TextField } from "@/components/TextField";
import { AmountInput } from "@/components/AmountInput";
import { FormSelect } from "@/components/forms/FormSelect";
import { Button } from "@/components/Button";
import { ErrorBanner } from "@/components/ErrorBanner";
import { useUnsavedChangesGuard, confirmLeaveIfDirty } from "@/lib/forms/useUnsavedChangesGuard";

type Option = { id: string; name: string };

const WEEKDAY_OPTIONS = [1, 2, 3, 4, 5, 6, 0].map((d) => ({ value: String(d), label: WEEKDAY_LABELS[d] }));

function friendly(message: string | undefined) {
  if (message && /[çğıöşüÇĞİÖŞÜ]/.test(message)) return message;
  return "Kural oluşturulamadı. Lütfen tekrar dene.";
}

export function RecurringTxForm({
  bookId,
  homeHref,
  accounts,
  incomeCategories,
  expenseCategories,
}: {
  bookId: string;
  homeHref: string;
  accounts: Option[];
  incomeCategories: Option[];
  expenseCategories: Option[];
}) {
  const router = useRouter();
  const submittingRef = useRef(false);
  const [type, setType] = useState<"income" | "expense">("expense");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [categoryId, setCategoryId] = useState("");
  const [frequency, setFrequency] = useState<"monthly" | "weekly">("monthly");
  const [dayOfMonth, setDayOfMonth] = useState("1");
  const [dayOfWeek, setDayOfWeek] = useState("1");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDirty = description !== "" || amount !== "";
  useUnsavedChangesGuard(isDirty);
  const categories = type === "income" ? incomeCategories : expenseCategories;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submittingRef.current) return;
    setError(null);
    const trimmed = description.trim();
    if (!trimmed) return setError("Bir açıklama yaz (ör. Maaş, Netflix).");
    const cents = amountInputToCents(amount);
    if (cents === null || cents <= 0) return setError("Geçerli bir tutar gir.");
    if (!accountId) return setError("Bir hesap seç.");

    submittingRef.current = true;
    setSubmitting(true);
    try {
      const { data, error: rpcError } = await createRecurringTxRule(createClient(), {
        bookId,
        accountId,
        categoryId: categoryId || null,
        type,
        amountCents: cents,
        description: trimmed,
        frequency,
        dayOfMonth: frequency === "monthly" ? Number(dayOfMonth) : null,
        dayOfWeek: frequency === "weekly" ? Number(dayOfWeek) : null,
        startDate: null,
      });
      if (rpcError) return setError(friendly(rpcError.message));
      const sep = homeHref.includes("?") ? "&" : "?";
      router.push(`${homeHref}${data?.created_now ? `${sep}created=${data.created_now}` : ""}`);
      router.refresh();
    } catch {
      setError("Kural oluşturulamadı. Lütfen tekrar dene.");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  if (accounts.length === 0) {
    return (
      <AppShell variant="subpage" title="Yeni tekrarlayan kayıt" parentHref={homeHref}>
        <p className="py-8 text-center text-sm text-text-muted">Önce bir hesap eklemelisin; kayıtlar bu hesaba işlenir.</p>
      </AppShell>
    );
  }

  return (
    <AppShell variant="subpage" title="Yeni tekrarlayan kayıt" parentHref={homeHref} backGuard={() => confirmLeaveIfDirty(isDirty)}>
      <form id="recurring-tx-form" onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4 pt-3 pb-4">
        {error ? <ErrorBanner message={error} /> : null}
        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-surface-muted p-1" role="radiogroup" aria-label="Tür">
          {(["expense", "income"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={type === t}
              onClick={() => {
                setType(t);
                setCategoryId("");
              }}
              className={`rounded-xl py-2 text-sm font-bold transition-colors ${
                type === t ? (t === "income" ? "bg-income text-white" : "bg-expense text-white") : "text-text-secondary"
              }`}
            >
              {t === "income" ? "Gelir" : "Gider"}
            </button>
          ))}
        </div>
        <TextField
          label="Açıklama"
          placeholder={type === "income" ? "Örn. Maaş, Kira geliri" : "Örn. Netflix, İnternet faturası"}
          required
          maxLength={120}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <AmountInput label="Tutar" value={amount} onChange={setAmount} allowNegative={false} />
        <FormSelect label="Hesap" value={accountId} onChange={(e) => setAccountId(e.target.value)} options={accounts.map((a) => ({ value: a.id, label: a.name }))} />
        <FormSelect
          label="Kategori (isteğe bağlı)"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          options={[{ value: "", label: "Kategorisiz" }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
        />
        <FormSelect
          label="Sıklık"
          value={frequency}
          onChange={(e) => setFrequency(e.target.value as "monthly" | "weekly")}
          options={[
            { value: "monthly", label: "Her ay" },
            { value: "weekly", label: "Her hafta" },
          ]}
        />
        {frequency === "monthly" ? (
          <FormSelect
            label="Ayın günü"
            value={dayOfMonth}
            onChange={(e) => setDayOfMonth(e.target.value)}
            options={Array.from({ length: 28 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))}
          />
        ) : (
          <FormSelect label="Haftanın günü" value={dayOfWeek} onChange={(e) => setDayOfWeek(e.target.value)} options={WEEKDAY_OPTIONS} />
        )}
        <p className="rounded-2xl border border-dashed border-border-strong p-3.5 text-xs text-text-muted">
          Kayıt, seçtiğin günün sabahı otomatik eklenir ve hesap bakiyene yansır. Seçtiğin gün bugünse ilk kayıt hemen eklenir. Ayın
          29–31&apos;i kısa aylarda sorun çıkarmasın diye günler 1–28 arasındadır.
        </p>
      </form>
      <div className="sticky bottom-0 border-t border-border bg-bg pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        <Button type="submit" form="recurring-tx-form" loading={submitting}>
          Kuralı oluştur
        </Button>
      </div>
    </AppShell>
  );
}
