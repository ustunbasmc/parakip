"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createBudget } from "@/lib/api/financial-rpc";
import { amountInputToCents } from "@/lib/format/amount";
import { AppShell } from "@/components/AppShell";
import { AmountInput } from "@/components/AmountInput";
import { FormSelect } from "@/components/forms/FormSelect";
import { Button } from "@/components/Button";
import { ErrorBanner } from "@/components/ErrorBanner";
import { useUnsavedChangesGuard, confirmLeaveIfDirty } from "@/lib/forms/useUnsavedChangesGuard";
import type { CategoryOption } from "@/lib/dashboard/formData";

function currentMonthIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

/**
 * "Toplam" ve "Kategori bazlı" bütçeler BAĞIMSIZ, örtüşen ölçümlerdir
 * (bkz. migration 0022) — bu formda ikisi arasında basit bir seçim
 * sunulur, kullanıcıya bu ayrımın anlamı kısaca açıklanır.
 */
export function BudgetForm({ bookId, homeHref, categories }: { bookId: string; homeHref: string; categories: CategoryOption[] }) {
  const router = useRouter();
  const submittingRef = useRef(false);

  const [scope, setScope] = useState<"total" | "category">("total");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [amount, setAmount] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDirty = amount !== "";
  useUnsavedChangesGuard(isDirty);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (submittingRef.current) return;

    const cents = amountInputToCents(amount);
    if (cents === null || cents <= 0) {
      setError("Geçerli bir bütçe tutarı gir.");
      return;
    }
    if (scope === "category" && !categoryId) {
      setError("Bir kategori seçmelisin.");
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    const supabase = createClient();
    const { error: rpcError } = await createBudget(supabase, {
      p_book_id: bookId,
      p_amount_cents: cents,
      p_period_month: currentMonthIso(),
      p_category_id: scope === "category" ? categoryId : null,
    });
    submittingRef.current = false;
    setSubmitting(false);

    if (rpcError) {
      setError(rpcError.message || "Bütçe oluşturulamadı.");
      return;
    }

    router.refresh();
    router.push(homeHref);
  }

  return (
    <AppShell variant="subpage" title="Yeni bütçe" backFallbackHref={homeHref} backGuard={() => confirmLeaveIfDirty(isDirty)}>
      <form id="budget-form" onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4 pt-3 pb-4">
        {error ? <ErrorBanner message={error} /> : null}

        <div className="flex gap-1 rounded-full bg-surface-muted p-1">
          <button
            type="button"
            onClick={() => setScope("total")}
            className={`flex-1 rounded-full py-2 text-sm font-semibold ${scope === "total" ? "bg-accent text-text-on-accent" : "text-text-secondary"}`}
          >
            Toplam bütçe
          </button>
          <button
            type="button"
            onClick={() => setScope("category")}
            className={`flex-1 rounded-full py-2 text-sm font-semibold ${scope === "category" ? "bg-accent text-text-on-accent" : "text-text-secondary"}`}
          >
            Kategori bazlı
          </button>
        </div>
        <p className="text-xs text-text-muted">
          {scope === "total"
            ? "Bu ay, bu deftere ait TÜM giderleri kapsar."
            : "Yalnızca seçtiğin kategorideki giderleri kapsar — toplam bütçeden bağımsız, ayrı bir ölçümdür."}
        </p>

        {scope === "category" ? (
          <FormSelect
            label="Kategori"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
            disabled={categories.length === 0}
            placeholder={categories.length === 0 ? "Önce bir gider kategorisi eklemelisin" : "Seçiniz"}
          />
        ) : null}

        <AmountInput label="Aylık bütçe tutarı" value={amount} onChange={setAmount} allowNegative={false} autoFocus />
      </form>

      <div className="sticky bottom-0 border-t border-border bg-bg pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        <Button type="submit" form="budget-form" loading={submitting}>
          Bütçeyi oluştur
        </Button>
      </div>
    </AppShell>
  );
}
