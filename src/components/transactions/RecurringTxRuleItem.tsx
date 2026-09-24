"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatCentsAsCurrency } from "@/lib/format/amount";
import { describeSchedule, setRecurringTxRuleActive, type RecurringTxRule } from "@/lib/dashboard/recurringTransactions";

const dateFmt = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", timeZone: "UTC" });
function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return dateFmt.format(new Date(Date.UTC(y, m - 1, d)));
}

export function RecurringTxRuleItem({ rule, canToggle }: { rule: RecurringTxRule; canToggle: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    const msg = rule.isActive
      ? "Kural durdurulsun mu? Yeni kayıt oluşturulmaz; daha önce eklenenler kalır."
      : "Kural yeniden başlatılsın mı? Geçmiş dönemler toplu eklenmez, bir sonraki vadeden devam eder.";
    if (!window.confirm(msg)) return;
    setBusy(true);
    setError(null);
    const { error: rpcError } = await setRecurringTxRuleActive(createClient(), rule.id, !rule.isActive);
    setBusy(false);
    if (rpcError) setError("İşlem gerçekleştirilemedi.");
    else router.refresh();
  }

  const income = rule.type === "income";
  return (
    <div className={`surface-card flex flex-col gap-2 rounded-2xl p-4 ${rule.isActive ? "" : "opacity-70"}`}>
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-text-primary">{rule.description}</p>
          <p className="truncate text-xs text-text-muted">
            {describeSchedule(rule)}
            {rule.accountName ? ` · ${rule.accountName}` : ""}
            {rule.categoryName ? ` · ${rule.categoryName}` : ""}
          </p>
        </div>
        <p className={`shrink-0 text-sm font-extrabold tabular-nums ${income ? "text-income" : "text-expense"}`}>
          {income ? "+" : "−"}
          {formatCentsAsCurrency(rule.amountCents, "TRY")}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="text-text-secondary">
          {rule.isActive ? `Sonraki: ${fmtDate(rule.nextDueDate)}` : "Durduruldu"}
          {rule.runCount > 0 ? ` · ${rule.runCount} kez eklendi` : ""}
        </span>
        {canToggle ? (
          <button type="button" onClick={toggle} disabled={busy} className="font-semibold text-accent disabled:opacity-60">
            {rule.isActive ? "Durdur" : "Yeniden başlat"}
          </button>
        ) : null}
      </div>
      {rule.isActive && rule.lastError ? (
        <p className="rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning">Son deneme eklenemedi: {rule.lastError} Yarın sabah yeniden denenecek.</p>
      ) : null}
      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}
