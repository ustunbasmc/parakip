"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { setRecurringPaymentRuleActive } from "@/lib/api/financial-rpc";
import { formatCentsAsCurrency } from "@/lib/format/amount";
import { formatDueDateLabel } from "@/lib/format/date";
import type { RecurringRuleRow } from "@/lib/dashboard/debts";

const FREQ_LABEL = { monthly: "Her ay", weekly: "Her hafta" } as const;
const WEEKDAY_NAMES = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];

export function RecurringRuleListItem({ rule, canManage }: { rule: RecurringRuleRow; canManage: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scheduleLabel =
    rule.frequency === "monthly"
      ? `${FREQ_LABEL.monthly} · ayın ${rule.dayOfMonth}. günü`
      : `${FREQ_LABEL.weekly} · ${WEEKDAY_NAMES[rule.dayOfWeek ?? 0]}`;

  async function handleToggle() {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: rpcError } = await setRecurringPaymentRuleActive(supabase, {
      p_rule_id: rule.id,
      p_is_active: !rule.isActive,
    });
    setLoading(false);
    if (rpcError) {
      setError(rpcError.message || "İşlem gerçekleştirilemedi.");
      return;
    }
    router.refresh();
  }

  return (
    <div className={`rounded-2xl border border-border bg-surface p-3.5 ${!rule.isActive ? "opacity-60" : ""}`}>
      {error ? <p className="mb-2 text-xs text-danger">{error}</p> : null}
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-text-primary">{rule.counterpartyName}</p>
          <p className="text-xs text-text-muted">{scheduleLabel}</p>
          <p className="text-xs text-text-muted">Sıradaki: {formatDueDateLabel(rule.nextDueDate)}</p>
        </div>
        <p className={`shrink-0 text-sm font-bold tabular-nums ${rule.direction === "payable" ? "text-danger" : "text-success"}`}>
          {formatCentsAsCurrency(rule.amountCents, "TRY")}
        </p>
      </div>
      {canManage ? (
        <button
          onClick={handleToggle}
          disabled={loading}
          className="mt-2 text-xs font-semibold text-accent disabled:opacity-40"
        >
          {rule.isActive ? "Durdur" : "Yeniden başlat"}
        </button>
      ) : null}
    </div>
  );
}
