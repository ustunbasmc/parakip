"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createTransfer } from "@/lib/api/financial-rpc";
import { amountInputToCents, formatCentsAsCurrency } from "@/lib/format/amount";
import { AppShell } from "@/components/AppShell";
import { AmountInput } from "@/components/AmountInput";
import { FormSelect } from "@/components/forms/FormSelect";
import { TextField } from "@/components/TextField";
import { Button } from "@/components/Button";
import { ErrorBanner } from "@/components/ErrorBanner";
import { FormSuccessState } from "@/components/forms/FormSuccessState";
import { AlertIcon } from "@/components/icons";
import { useUnsavedChangesGuard, confirmLeaveIfDirty } from "@/lib/forms/useUnsavedChangesGuard";
import type { SpaceWithAccounts } from "@/lib/dashboard/formData";

interface Props {
  bookId: string;
  homeHref: string;
  spaces: SpaceWithAccounts[];
  variant?: "page" | "modal";
  onSuccess?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}

interface FlatAccount {
  accountId: string;
  accountName: string;
  currency: string;
  bookId: string;
  spaceName: string;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function friendlyRpcError(message: string | undefined): string {
  if (!message) return "Transfer oluşturulamadı. Lütfen tekrar dene.";
  if (message.toLowerCase().includes("fetch")) {
    return "Bağlantı sorunu oluştu. İnternet bağlantını kontrol edip tekrar dene.";
  }
  return message;
}

/**
 * Tek bir kaynak/hedef hesap çifti, TÜM erişilebilir alanların (Ev +
 * İşletme) hesaplarından seçilebiliyor — bu yüzden "aynı defter içi" ve
 * "Ev-İşletme arası" transfer AYRI bir mod gerektirmeden doğal olarak
 * desteklenir: iki hesap aynı deftere aitse aynı-defter transferi, farklı
 * defterlere aitse cross-book transfer olur (create_transfer zaten her
 * iki book_id'yi de ayrı ayrı alıyor).
 *
 * ÇOKLU PARA BİRİMİ KISITI (önemli, bilinçli tasarım kararı):
 * create_transfer() RPC'si TEK bir p_amount_cents ve TEK bir p_currency
 * alır — kaynak ve hedef bacağa AYNI tutarı, AYNI para birimi etiketiyle
 * yazar (bkz. migration 0008/0010). Bu, GERÇEK bir kur dönüşümünü
 * (farklı tutarlarla) desteklemez. Bu formda farklı para birimli hesaplar
 * arasında transfer seçilirse, YANLIŞ bir muhasebe kaydı oluşturmaktansa
 * işlem DÜRÜSTÇE ENGELLENİR — bu, mevcut fonksiyonu değiştirmeden
 * (talimat gereği) doğru davranan tek seçenektir.
 */
export function TransferForm({ bookId, homeHref, spaces, variant = "page", onSuccess, onDirtyChange }: Props) {
  const router = useRouter();
  const submittingRef = useRef(false);

  const flatAccounts: FlatAccount[] = useMemo(
    () =>
      spaces.flatMap((s) =>
        s.accounts.map((a) => ({
          accountId: a.id,
          accountName: a.name,
          currency: a.currency,
          bookId: s.bookId,
          spaceName: s.spaceName,
        }))
      ),
    [spaces]
  );

  const showSpaceLabel = spaces.length > 1;
  const currentBookAccounts = flatAccounts.filter((a) => a.bookId === bookId);

  const [sourceId, setSourceId] = useState(currentBookAccounts[0]?.accountId ?? "");
  const [destId, setDestId] = useState(
    flatAccounts.find((a) => a.accountId !== currentBookAccounts[0]?.accountId)?.accountId ?? ""
  );
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayIso());
  const [note, setNote] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const isDirty = amount !== "" || note !== "" || date !== todayIso();
  useUnsavedChangesGuard(isDirty && !success);
  useEffect(() => {
    onDirtyChange?.(isDirty && !success);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDirty, success]);

  const source = flatAccounts.find((a) => a.accountId === sourceId);
  const dest = flatAccounts.find((a) => a.accountId === destId);
  const cents = amountInputToCents(amount);
  const sameAccount = Boolean(sourceId) && sourceId === destId;
  const currencyMismatch = Boolean(source && dest && source.currency !== dest.currency);

  function accountLabel(a: FlatAccount) {
    const base = showSpaceLabel ? `${a.accountName} · ${a.spaceName}` : a.accountName;
    return a.currency === "TRY" ? base : `${base} (${a.currency})`;
  }

  const summary =
    source && dest && cents && cents > 0 && !sameAccount && !currencyMismatch
      ? {
          amountLabel: formatCentsAsCurrency(cents, source.currency),
          fromLabel: accountLabel(source),
          toLabel: accountLabel(dest),
          dateLabel: new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric" }).format(
            new Date(date + "T00:00:00")
          ),
          note: note.trim(),
        }
      : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (submittingRef.current) return;

    if (!source || !dest) {
      setError("Kaynak ve hedef hesabı seçmelisin.");
      return;
    }
    if (sameAccount) {
      setError("Kaynak ve hedef hesap aynı olamaz.");
      return;
    }
    if (currencyMismatch) {
      setError("Farklı para birimleri arasında transfer şu anda desteklenmiyor.");
      return;
    }
    if (cents === null || cents <= 0) {
      setError("Geçerli bir tutar gir.");
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);

    const supabase = createClient();
    const { error: rpcError } = await createTransfer(supabase, {
      p_from_book_id: source.bookId,
      p_from_account_id: source.accountId,
      p_to_book_id: dest.bookId,
      p_to_account_id: dest.accountId,
      p_amount_cents: cents,
      p_currency: source.currency,
      p_occurred_at: new Date(date + "T12:00:00").toISOString(),
      p_from_note: note.trim() || null,
      p_to_note: note.trim() || null,
    });

    submittingRef.current = false;
    setSubmitting(false);

    if (rpcError) {
      setError(friendlyRpcError(rpcError.message));
      return;
    }

    setSuccess(true);
    router.refresh();
    if (variant === "modal") {
      setTimeout(() => onSuccess?.(), 900);
    } else {
      setTimeout(() => router.push(homeHref), 900);
    }
  }

  if (success && summary) {
    const body = <FormSuccessState message={`${summary.amountLabel} · ${summary.fromLabel} → ${summary.toLabel}`} />;
    if (variant === "modal") return body;
    return (
      <AppShell variant="subpage" title="Transfer yap" backFallbackHref={homeHref}>
        {body}
      </AppShell>
    );
  }

  const formBody = (
    <>
      <form id="transfer-form" onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4 pt-3 pb-4">
        {error ? <ErrorBanner message={error} /> : null}

        <FormSelect
          label="Kaynak hesap"
          value={sourceId}
          onChange={(e) => setSourceId(e.target.value)}
          options={flatAccounts.map((a) => ({ value: a.accountId, label: accountLabel(a) }))}
        />

        <FormSelect
          label="Hedef hesap"
          value={destId}
          onChange={(e) => setDestId(e.target.value)}
          options={flatAccounts.map((a) => ({ value: a.accountId, label: accountLabel(a) }))}
        />

        {sameAccount ? (
          <ErrorBanner message="Kaynak ve hedef hesap aynı olamaz." />
        ) : currencyMismatch ? (
          <div className="flex items-start gap-2 rounded-2xl border border-warning/40 bg-warning-soft p-3.5 text-sm text-warning">
            <AlertIcon size={18} className="mt-0.5 shrink-0" />
            <p>
              <strong>{source?.currency}</strong> ile <strong>{dest?.currency}</strong> arasında transfer şu anda
              desteklenmiyor. Bu özellik için para birimi dönüşüm altyapısı gerekiyor — aynı para biriminde iki
              hesap seç.
            </p>
          </div>
        ) : null}

        <AmountInput label="Tutar" value={amount} onChange={setAmount} allowNegative={false} />

        <TextField label="Tarih" type="date" value={date} onChange={(e) => setDate(e.target.value)} max={todayIso()} />

        <TextField
          label="Açıklama (isteğe bağlı)"
          placeholder="Örn. Aylık tasarruf aktarımı"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        {summary ? (
          <div className="mt-1 rounded-2xl border border-border bg-surface-muted p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Özet</p>
            <p className="text-sm text-text-secondary">
              {summary.fromLabel} <span className="text-text-muted">→</span> {summary.toLabel}
            </p>
            <p className="mt-1 text-xl font-bold tabular-nums text-text-primary">{summary.amountLabel}</p>
            <p className="mt-1 text-xs text-text-muted">
              {summary.dateLabel}
              {summary.note ? ` · ${summary.note}` : ""}
            </p>
          </div>
        ) : null}
      </form>

      <div className={variant === "modal" ? "sticky bottom-0 border-t border-border bg-bg pt-3" : "sticky bottom-0 border-t border-border bg-bg pb-[max(1rem,env(safe-area-inset-bottom))] pt-3"}>
        <Button type="submit" form="transfer-form" loading={submitting} disabled={currencyMismatch || sameAccount}>
          Transfer yap
        </Button>
      </div>
    </>
  );

  if (variant === "modal") return formBody;

  return (
    <AppShell
      variant="subpage"
      title="Transfer yap"
      backFallbackHref={homeHref}
      backGuard={() => confirmLeaveIfDirty(isDirty)}
    >
      {formBody}
    </AppShell>
  );
}
