"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { amountInputToCents } from "@/lib/format/amount";
import { createGoal, updateGoal } from "@/lib/dashboard/goals";
import { AppShell } from "@/components/AppShell";
import { TextField } from "@/components/TextField";
import { AmountInput } from "@/components/AmountInput";
import { Button } from "@/components/Button";
import { ErrorBanner } from "@/components/ErrorBanner";
import { useUnsavedChangesGuard, confirmLeaveIfDirty } from "@/lib/forms/useUnsavedChangesGuard";

const SUGGESTIONS = ["Tatil", "Acil durum fonu", "Araba", "Ev peşinatı", "Eğitim", "Düğün"];

/** Veritabanı hata metinleri zaten Türkçe; teknik hatalarda genel metin. */
function friendly(message: string | undefined) {
  if (message && /[çğıöşüÇĞİÖŞÜ]/.test(message)) return message;
  return "Kaydedilemedi. Lütfen tekrar dene.";
}

export function GoalForm({
  bookId,
  homeHref,
  goal,
}: {
  bookId: string;
  homeHref: string;
  /** Verilirse düzenleme modu. */
  goal?: { id: string; name: string; targetCents: number; targetDate: string | null };
}) {
  const router = useRouter();
  const submittingRef = useRef(false);
  const [name, setName] = useState(goal?.name ?? "");
  const [amount, setAmount] = useState(goal ? String(goal.targetCents / 100).replace(".", ",") : "");
  const [targetDate, setTargetDate] = useState(goal?.targetDate ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDirty = goal
    ? name !== goal.name || amount !== String(goal.targetCents / 100).replace(".", ",") || targetDate !== (goal.targetDate ?? "")
    : name !== "" || amount !== "" || targetDate !== "";
  useUnsavedChangesGuard(isDirty);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submittingRef.current) return;
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) return setError("Hedefe bir ad ver.");
    const cents = amountInputToCents(amount);
    if (cents === null || cents <= 0) return setError("Geçerli bir hedef tutarı gir.");

    submittingRef.current = true;
    setSubmitting(true);
    try {
      const supabase = createClient();
      if (goal) {
        const { error: rpcError } = await updateGoal(supabase, { goalId: goal.id, name: trimmed, targetCents: cents, targetDate: targetDate || null });
        if (rpcError) return setError(friendly(rpcError.message));
        router.push(homeHref);
        router.refresh();
      } else {
        const { data, error: rpcError } = await createGoal(supabase, { bookId, name: trimmed, targetCents: cents, targetDate: targetDate || null });
        if (rpcError) return setError(friendly(rpcError.message));
        const space = new URLSearchParams(homeHref.split("?")[1] ?? "").get("space");
        router.push(`/goals/${data}${space ? `?space=${space}` : ""}`);
        router.refresh();
      }
    } catch {
      setError("Kaydedilemedi. Lütfen tekrar dene.");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <AppShell variant="subpage" title={goal ? "Hedefi düzenle" : "Yeni birikim hedefi"} parentHref={homeHref} backGuard={() => confirmLeaveIfDirty(isDirty)}>
      <form id="goal-form" onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4 pt-3 pb-4">
        {error ? <ErrorBanner message={error} /> : null}
        <TextField label="Hedefin adı" placeholder="Örn. Yaz tatili" required autoFocus value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
        {!goal ? (
          <div className="-mt-2 flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setName(s)}
                className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-semibold text-text-secondary hover:bg-surface-muted"
              >
                {s}
              </button>
            ))}
          </div>
        ) : null}
        <AmountInput label="Hedef tutarı" value={amount} onChange={setAmount} allowNegative={false} />
        <TextField
          label="Hedef tarihi (isteğe bağlı)"
          type="date"
          value={targetDate}
          onChange={(e) => setTargetDate(e.target.value)}
          hint="Tarih verirsen ayda ne kadar ayırman gerektiğini hesaplarız."
        />
        <p className="rounded-2xl border border-dashed border-border-strong p-3.5 text-xs text-text-muted">
          Hedefe eklediğin tutarlar &quot;bu hedef için ayırdım&quot; kaydıdır; hesap bakiyeni değiştirmez.
        </p>
      </form>
      <div className="sticky bottom-0 border-t border-border bg-bg pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        <Button type="submit" form="goal-form" loading={submitting}>
          {goal ? "Kaydet" : "Hedefi oluştur"}
        </Button>
      </div>
    </AppShell>
  );
}
