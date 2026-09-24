"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { amountInputToCents, formatCentsAsCurrency } from "@/lib/format/amount";
import { addGoalContribution, cancelGoalContribution, setGoalArchived, type GoalContribution, type GoalStatus } from "@/lib/dashboard/goals";
import { AmountInput } from "@/components/AmountInput";
import { TextField } from "@/components/TextField";
import { Button } from "@/components/Button";
import { ErrorBanner } from "@/components/ErrorBanner";
import { formatGoalDate } from "./GoalCard";

function friendly(message: string | undefined) {
  if (message && /[çğıöşüÇĞİÖŞÜ]/.test(message)) return message;
  return "İşlem gerçekleştirilemedi. Lütfen tekrar dene.";
}

/**
 * Hedef detayındaki işlemler: para ekle/çek, katkı iptali, arşivleme.
 * Hepsi RPC ile; kurallar (0'ın altına inmeme, limit, yetki) veritabanında.
 */
export function GoalActions({
  goalId,
  status,
  savedCents,
  currency,
  canEdit,
  contributions,
}: {
  goalId: string;
  status: GoalStatus;
  savedCents: number;
  currency: string;
  canEdit: boolean;
  contributions: GoalContribution[];
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"add" | "withdraw" | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const archived = status === "archived";

  async function run(key: string, fn: () => PromiseLike<{ error: { message?: string } | null }>) {
    setBusy(key);
    setError(null);
    try {
      const { error: rpcError } = await fn();
      if (rpcError) {
        setError(friendly(rpcError.message));
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError("İşlem gerçekleştirilemedi. Lütfen tekrar dene.");
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const cents = amountInputToCents(amount);
    if (cents === null || cents <= 0) return setError("Geçerli bir tutar gir.");
    const signed = mode === "withdraw" ? -cents : cents;
    const ok = await run("save", () => addGoalContribution(createClient(), { goalId, amountCents: signed, note: note.trim() || null, date: null }));
    if (ok) {
      setAmount("");
      setNote("");
      setMode(null);
    }
  }

  const active = contributions.filter((c) => c.status === "active");

  return (
    <div className="flex flex-col gap-4">
      {error ? <ErrorBanner message={error} /> : null}

      {canEdit && !archived ? (
        mode ? (
          <form onSubmit={submit} className="surface-card flex flex-col gap-3 rounded-3xl p-4">
            <p className="text-sm font-bold text-text-primary">{mode === "add" ? "Hedefe para ekle" : "Hedeften para çek"}</p>
            <AmountInput label="Tutar" value={amount} onChange={setAmount} allowNegative={false} autoFocus />
            <TextField label="Not (isteğe bağlı)" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />
            {mode === "withdraw" ? (
              <p className="text-xs text-text-muted">En fazla {formatCentsAsCurrency(savedCents, currency)} çekebilirsin.</p>
            ) : null}
            <div className="flex gap-2">
              <Button type="submit" loading={busy === "save"} fullWidth={false}>
                Kaydet
              </Button>
              <Button type="button" variant="ghost" fullWidth={false} onClick={() => setMode(null)}>
                Vazgeç
              </Button>
            </div>
          </form>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => setMode("add")}>Para ekle</Button>
            <Button variant="secondary" onClick={() => setMode("withdraw")} disabled={savedCents <= 0}>
              Para çek
            </Button>
          </div>
        )
      ) : null}

      <section className="surface-card rounded-3xl p-4">
        <p className="mb-3 text-sm font-bold text-text-primary">Hareketler</p>
        {active.length === 0 ? (
          <p className="text-sm text-text-muted">Henüz bu hedefe para eklenmedi.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {active.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="min-w-0">
                  <span className="block truncate text-text-primary">{c.note || (c.amountCents > 0 ? "Para eklendi" : "Para çekildi")}</span>
                  <span className="block text-xs text-text-muted">{formatGoalDate(c.contributedOn)}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className={`font-semibold tabular-nums ${c.amountCents > 0 ? "text-income" : "text-expense"}`}>
                    {c.amountCents > 0 ? "+" : "−"}
                    {formatCentsAsCurrency(Math.abs(c.amountCents), currency)}
                  </span>
                  {canEdit && !archived ? (
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => {
                        if (window.confirm("Bu kayıt iptal edilsin mi?")) void run(`cancel-${c.id}`, () => cancelGoalContribution(createClient(), c.id));
                      }}
                      className="rounded-lg px-1.5 py-1 text-xs font-semibold text-text-muted hover:text-danger"
                      aria-label="Kaydı iptal et"
                    >
                      İptal
                    </button>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {canEdit ? (
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => {
            const msg = archived ? "Hedef yeniden etkinleştirilsin mi?" : "Hedef arşivlensin mi? Kayıtları silinmez, istediğin zaman geri alabilirsin.";
            if (window.confirm(msg)) void run("archive", () => setGoalArchived(createClient(), goalId, !archived));
          }}
          className="self-start text-sm font-semibold text-text-secondary hover:text-text-primary"
        >
          {archived ? "Arşivden çıkar" : "Hedefi arşivle"}
        </button>
      ) : null}
    </div>
  );
}
