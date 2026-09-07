"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { amountInputToCents } from "@/lib/format/amount";
import { ACCOUNT_TYPE_OPTIONS } from "@/lib/format/accountType";
import { AppShell } from "@/components/AppShell";
import { TextField } from "@/components/TextField";
import { AmountInput } from "@/components/AmountInput";
import { FormSelect } from "@/components/forms/FormSelect";
import { Button } from "@/components/Button";
import { ErrorBanner } from "@/components/ErrorBanner";
import { useUnsavedChangesGuard, confirmLeaveIfDirty } from "@/lib/forms/useUnsavedChangesGuard";

const CURRENCY_OPTIONS = [
  { value: "TRY", label: "Türk Lirası (TRY)" },
  { value: "USD", label: "Amerikan Doları (USD)" },
  { value: "EUR", label: "Euro (EUR)" },
  { value: "GBP", label: "İngiliz Sterlini (GBP)" },
];

/** Yalnızca bu türde negatif açılış bakiyesi anlamlıdır (bkz. migration 0041 CHECK kısıtı). */
const DEBT_LIKE_TYPES = new Set(["credit_card"]);

interface Props {
  bookId: string;
  homeHref: string;
  variant?: "page" | "modal";
  onSuccess?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}

export function AccountForm({ bookId, homeHref, variant = "page", onSuccess, onDirtyChange }: Props) {
  const router = useRouter();
  const submittingRef = useRef(false);

  const [name, setName] = useState("");
  const [type, setType] = useState("bank");
  const [currency, setCurrency] = useState("TRY");
  const [openingBalance, setOpeningBalance] = useState("");
  const [note, setNote] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDirty = name !== "" || openingBalance !== "" || note !== "" || type !== "bank" || currency !== "TRY";
  useUnsavedChangesGuard(isDirty);
  useEffect(() => {
    onDirtyChange?.(isDirty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDirty]);

  const allowNegative = DEBT_LIKE_TYPES.has(type);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (submittingRef.current) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Hesap adı boş olamaz.");
      return;
    }

    const cents = openingBalance.trim() === "" ? 0 : amountInputToCents(openingBalance);
    if (cents === null) {
      setError("Açılış bakiyesi geçerli bir tutar değil.");
      return;
    }
    if (cents < 0 && !allowNegative) {
      setError("Negatif açılış bakiyesi yalnızca kredi kartı gibi borç niteliğindeki hesaplarda girilebilir.");
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);

    const supabase = createClient();
    const { error: insertError } = await supabase.from("accounts").insert({
      book_id: bookId,
      name: trimmedName,
      type,
      currency,
      opening_balance_cents: cents,
      note: note.trim() || null,
    });

    submittingRef.current = false;
    setSubmitting(false);

    if (insertError) {
      if (insertError.message.includes("row-level security")) {
        setError("Bu işlem için yetkin yok.");
      } else if (insertError.message.toLowerCase().includes("accounts_negative_opening_balance")) {
        setError("Negatif açılış bakiyesi yalnızca kredi kartı gibi borç niteliğindeki hesaplarda girilebilir.");
      } else if (insertError.message) {
        setError(insertError.message);
      } else {
        setError("Hesap oluşturulamadı. Lütfen tekrar dene.");
      }
      return;
    }

    if (variant === "modal") onSuccess?.();
    else router.push(homeHref);
  }

  const formBody = (
    <>
      <form id="account-form" onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4 pt-3 pb-4">
        {error ? <ErrorBanner message={error} /> : null}

        <TextField
          label="Hesap adı"
          placeholder="Örn. Ana banka hesabım"
          required
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <FormSelect
          label="Hesap türü"
          value={type}
          onChange={(e) => setType(e.target.value)}
          options={ACCOUNT_TYPE_OPTIONS}
        />

        <FormSelect
          label="Para birimi"
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          options={CURRENCY_OPTIONS}
        />

        <AmountInput
          label="Açılış bakiyesi (isteğe bağlı)"
          value={openingBalance}
          onChange={setOpeningBalance}
          allowNegative={allowNegative}
          hint={
            allowNegative
              ? "Kredi kartı borcun varsa eksi (-) ile gir."
              : "Boş bırakırsan 0 ile başlar. Bu hesap türünde negatif bakiye girilemez."
          }
        />

        <TextField
          label="Açıklama (isteğe bağlı)"
          placeholder="Örn. Ortak hesap"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </form>

      <div className={variant === "modal" ? "sticky bottom-0 border-t border-border bg-bg pt-3" : "sticky bottom-0 border-t border-border bg-bg pb-[max(1rem,env(safe-area-inset-bottom))] pt-3"}>
        <Button type="submit" form="account-form" loading={submitting}>
          Hesabı oluştur
        </Button>
      </div>
    </>
  );

  if (variant === "modal") return formBody;

  return (
    <AppShell
      variant="subpage"
      title="Yeni hesap"
      backFallbackHref={homeHref}
      backGuard={() => confirmLeaveIfDirty(isDirty)}
    >
      {formBody}
    </AppShell>
  );
}
