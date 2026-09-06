"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { amountInputToCents } from "@/lib/format/amount";
import { ScreenShell } from "@/components/ScreenShell";
import { TextField } from "@/components/TextField";
import { AmountInput } from "@/components/AmountInput";
import { Button } from "@/components/Button";
import { ErrorBanner } from "@/components/ErrorBanner";

const ACCOUNT_TYPES: { value: string; label: string }[] = [
  { value: "cash", label: "Nakit" },
  { value: "bank", label: "Banka hesabı" },
  { value: "credit_card", label: "Kredi kartı" },
  { value: "other", label: "Diğer" },
];

function FirstAccountForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bookId = searchParams.get("book_id");

  const [name, setName] = useState("");
  const [type, setType] = useState("bank");
  const [openingBalance, setOpeningBalance] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allowNegative = type === "credit_card";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!bookId) {
      setError("Defter bulunamadı. Lütfen baştan başla.");
      return;
    }
    if (name.trim().length === 0) {
      setError("Hesap adı boş olamaz.");
      return;
    }

    const cents = openingBalance.trim() === "" ? 0 : amountInputToCents(openingBalance);
    if (cents === null) {
      setError("Açılış bakiyesi geçerli bir tutar değil.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { data, error: insertError } = await supabase
      .from("accounts")
      .insert({
        book_id: bookId,
        name: name.trim(),
        type,
        opening_balance_cents: cents,
        currency: "TRY",
      })
      .select("id")
      .single();
    setLoading(false);

    if (insertError || !data) {
      setError("Hesap oluşturulamadı. Lütfen tekrar dene.");
      return;
    }

    router.push(`/onboarding/first-transaction?book_id=${bookId}&account_id=${data.id}`);
  }

  function handleSkip() {
    router.push("/home");
  }

  return (
    <ScreenShell
      backFallbackHref="/onboarding/space-type"
      footer={
        <div className="flex flex-col gap-2">
          <Button type="submit" form="first-account-form" loading={loading}>
            Hesabı ekle
          </Button>
          <Button type="button" variant="ghost" onClick={handleSkip} fullWidth={false}>
            Şimdi değil, sonra eklerim
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-6 pt-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">İlk hesabını ekle</h1>
          <p className="mt-1 text-text-secondary">
            Nakit, banka veya kredi kartı — hangisiyle başlamak istersin?
          </p>
        </div>

        {error ? <ErrorBanner message={error} /> : null}

        <form id="first-account-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
          <TextField
            label="Hesap adı"
            placeholder="Örn. Ana banka hesabım"
            required
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <div className="flex flex-col gap-1.5">
            <label htmlFor="account-type" className="text-sm font-medium text-text-secondary">
              Hesap türü
            </label>
            <select
              id="account-type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="h-14 rounded-2xl border border-border bg-surface px-4 text-[1.0625rem] text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            >
              {ACCOUNT_TYPES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <AmountInput
            label="Açılış bakiyesi (isteğe bağlı)"
            value={openingBalance}
            onChange={setOpeningBalance}
            allowNegative={allowNegative}
            hint={
              allowNegative
                ? "Kredi kartı borcun varsa eksi (-) ile gir."
                : "Boş bırakırsan 0 TL ile başlar."
            }
          />
        </form>
      </div>
    </ScreenShell>
  );
}

export default function FirstAccountPage() {
  return (
    <Suspense fallback={null}>
      <FirstAccountForm />
    </Suspense>
  );
}
