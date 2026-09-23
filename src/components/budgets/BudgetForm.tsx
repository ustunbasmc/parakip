"use client";

import { useEffect, useRef, useState } from "react";
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
import type { ExistingBudgetKeys } from "@/lib/dashboard/budgets";

function currentMonthIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

/**
 * create_budget'ın teknik (ASCII, kimlik içeren) hata mesajlarını
 * kullanıcının ne yapacağını anlatan Türkçe metne çevirir. Tanınmayan
 * hatalarda genel bir mesaj gösterilir; ham mesaj kullanıcıya gösterilmez.
 */
function friendlyBudgetError(message: string | undefined): string {
  const m = (message ?? "").toLowerCase();
  if (m.includes("zaten aktif bir toplam")) {
    return "Bu ay için zaten bir toplam bütçe var. Mevcut bütçeyi listeden açıp düzenleyebilir ya da kategori bazlı bir bütçe ekleyebilirsin.";
  }
  if (m.includes("kategori ve ay icin zaten")) {
    return "Bu kategori için bu ay zaten bir bütçe var. Başka bir kategori seçebilir ya da mevcut bütçeyi düzenleyebilirsin.";
  }
  if (m.includes("yetkiniz yok")) {
    return "Bu alanda bütçe oluşturma yetkin yok. Yalnızca sahip, yönetici veya düzenleyici bütçe ekleyebilir.";
  }
  if (m.includes("jwt") || m.includes("session")) {
    return "Oturumunun süresi dolmuş. Sayfayı yenileyip tekrar dene.";
  }
  if (m.includes("fetch") || m.includes("network")) {
    return "Bağlantı kurulamadı. İnternet bağlantını kontrol edip tekrar dene.";
  }
  return "Bütçe oluşturulamadı. Lütfen tekrar dene.";
}

interface Props {
  bookId: string;
  homeHref: string;
  categories: CategoryOption[];
  /** Bu ay zaten var olan aktif bütçeler — verilirse çakışan seçenekler baştan kapatılır. */
  existing?: ExistingBudgetKeys;
  variant?: "page" | "modal";
  onSuccess?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}

/**
 * "Toplam" ve "Kategori bazlı" bütçeler BAĞIMSIZ, örtüşen ölçümlerdir
 * (bkz. migration 0022) — bu formda ikisi arasında basit bir seçim
 * sunulur, kullanıcıya bu ayrımın anlamı kısaca açıklanır.
 *
 * HATA GÖRÜNÜRLÜĞÜ: Doğrulama hataları ilgili alanın altında, sunucu
 * hataları ise gönder butonunun HEMEN ÜSTÜNDE gösterilir — mobilde klavye
 * açıkken ve içerik kaydırılmışken formun en üstündeki bir mesaj
 * görünmüyor, kullanıcı "butona bastım, hiçbir şey olmadı" sanıyordu.
 */
export function BudgetForm({ bookId, homeHref, categories, existing, variant = "page", onSuccess, onDirtyChange }: Props) {
  const router = useRouter();
  const submittingRef = useRef(false);

  const totalTaken = existing?.hasTotal ?? false;
  const takenCategoryIds = new Set(existing?.categoryIds ?? []);
  const availableCategories = categories.filter((c) => !takenCategoryIds.has(c.id));

  const [scope, setScope] = useState<"total" | "category">(totalTaken ? "category" : "total");
  const [categoryId, setCategoryId] = useState(availableCategories[0]?.id ?? "");
  const [amount, setAmount] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [amountError, setAmountError] = useState<string | null>(null);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const isDirty = amount !== "";
  useUnsavedChangesGuard(isDirty);
  useEffect(() => {
    onDirtyChange?.(isDirty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDirty]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submittingRef.current) return;
    setAmountError(null);
    setCategoryError(null);
    setSubmitError(null);

    const cents = amountInputToCents(amount);
    let invalid = false;
    if (cents === null || cents <= 0) {
      setAmountError("Geçerli bir bütçe tutarı gir (ör. 5.000).");
      invalid = true;
    }
    if (scope === "total" && totalTaken) {
      setSubmitError(friendlyBudgetError("zaten aktif bir toplam"));
      invalid = true;
    }
    if (scope === "category" && !categoryId) {
      setCategoryError(
        availableCategories.length === 0
          ? "Bütçe eklenebilecek gider kategorisi yok. Önce Kategoriler ekranından bir gider kategorisi ekle."
          : "Bir kategori seçmelisin."
      );
      invalid = true;
    }
    if (invalid || cents === null) return;

    submittingRef.current = true;
    setSubmitting(true);
    try {
      const supabase = createClient();
      const { error: rpcError } = await createBudget(supabase, {
        p_book_id: bookId,
        p_amount_cents: cents,
        p_period_month: currentMonthIso(),
        p_category_id: scope === "category" ? categoryId : null,
      });
      if (rpcError) {
        setSubmitError(friendlyBudgetError(rpcError.message));
        return;
      }
    } catch (err) {
      setSubmitError(friendlyBudgetError(err instanceof Error ? err.message : undefined));
      return;
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }

    if (variant === "modal") onSuccess?.();
    else router.push(homeHref);
  }

  const formBody = (
    <>
      <form id="budget-form" onSubmit={handleSubmit} noValidate className="flex flex-1 flex-col gap-4 pt-3 pb-4">
        <div className="flex gap-1 rounded-2xl border border-border bg-surface p-1">
          <button
            type="button"
            onClick={() => setScope("total")}
            disabled={totalTaken}
            aria-pressed={scope === "total"}
            className={`flex-1 rounded-xl py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              scope === "total" ? "bg-accent text-text-on-accent" : "text-text-secondary"
            }`}
          >
            Toplam bütçe
          </button>
          <button
            type="button"
            onClick={() => setScope("category")}
            aria-pressed={scope === "category"}
            className={`flex-1 rounded-xl py-2 text-sm font-semibold transition-colors ${
              scope === "category" ? "bg-accent text-text-on-accent" : "text-text-secondary"
            }`}
          >
            Kategori bazlı
          </button>
        </div>

        {totalTaken ? (
          <p className="rounded-xl bg-warning-soft px-3 py-2 text-xs font-semibold text-warning">
            Bu ay için zaten bir toplam bütçen var. İstersen kategori bazlı bütçe ekleyebilir ya da mevcut toplam bütçeyi
            listeden açıp düzenleyebilirsin.
          </p>
        ) : (
          <p className="text-xs text-text-muted">
            {scope === "total"
              ? "Bu ay, bu deftere ait TÜM giderleri kapsar."
              : "Yalnızca seçtiğin kategorideki giderleri kapsar — toplam bütçeden bağımsız, ayrı bir ölçümdür."}
          </p>
        )}

        {scope === "category" ? (
          <FormSelect
            label="Kategori"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            options={availableCategories.map((c) => ({ value: c.id, label: c.name }))}
            disabled={availableCategories.length === 0}
            placeholder={
              availableCategories.length === 0
                ? categories.length === 0
                  ? "Önce bir gider kategorisi eklemelisin"
                  : "Tüm kategorilerin bu ay bütçesi var"
                : "Seçiniz"
            }
            error={categoryError ?? undefined}
          />
        ) : null}

        <AmountInput
          label="Aylık bütçe tutarı"
          value={amount}
          onChange={(v) => {
            setAmount(v);
            if (amountError) setAmountError(null);
          }}
          allowNegative={false}
          autoFocus
          error={amountError ?? undefined}
        />
      </form>

      <div
        className={
          variant === "modal"
            ? "sticky bottom-0 flex flex-col gap-2 border-t border-border bg-bg pt-3"
            : "sticky bottom-0 flex flex-col gap-2 border-t border-border bg-bg pb-[max(1rem,env(safe-area-inset-bottom))] pt-3"
        }
      >
        {submitError ? <ErrorBanner message={submitError} /> : null}
        <Button type="submit" form="budget-form" loading={submitting}>
          Bütçeyi oluştur
        </Button>
      </div>
    </>
  );

  if (variant === "modal") return formBody;

  return (
    <AppShell variant="subpage" title="Yeni bütçe" parentHref={homeHref} backGuard={() => confirmLeaveIfDirty(isDirty)}>
      {formBody}
    </AppShell>
  );
}
