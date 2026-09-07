"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cancelBudget } from "@/lib/api/financial-rpc";
import { formatCentsAsCurrency } from "@/lib/format/amount";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { ErrorBanner } from "@/components/ErrorBanner";
import { ConfirmModal } from "@/components/ConfirmModal";
import type { BudgetDetail } from "@/lib/dashboard/budgets";

const ALERT_BAR: Record<BudgetDetail["alertLevel"], string> = {
  ok: "bg-accent",
  warning_80: "bg-warning",
  exceeded: "bg-danger",
};
const ALERT_LABEL: Record<BudgetDetail["alertLevel"], string> = {
  ok: "Bütçe kontrol altında",
  warning_80: "%80 seviyesine ulaşıldı",
  exceeded: "Bütçe aşıldı",
};

export function BudgetDetailView({ budget, canManage, backHref }: { budget: BudgetDetail; canManage: boolean; backHref: string }) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remaining = budget.budgetCents - budget.usedCents;
  const monthLabel = new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric" }).format(new Date(budget.periodMonth));

  async function handleCancel() {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: rpcError } = await cancelBudget(supabase, { p_budget_id: budget.id });
    setLoading(false);
    setConfirmOpen(false);
    if (rpcError) {
      setError(rpcError.message || "İptal edilemedi.");
      return;
    }
    router.push(backHref);
  }

  return (
    <AppShell variant="subpage" title="Bütçe detayı" backFallbackHref={backHref}>
      <div className="flex flex-col gap-5 pt-3 pb-4">
        {error ? <ErrorBanner message={error} /> : null}

        <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface p-6 text-center">
          <p className="text-sm text-text-muted">
            {budget.categoryId === null ? "Toplam bütçe" : budget.categoryName} · {monthLabel}
          </p>
          <p className="text-3xl font-extrabold tabular-nums text-text-primary">
            {formatCentsAsCurrency(budget.usedCents, "TRY")}
          </p>
          <p className="text-xs text-text-muted">{formatCentsAsCurrency(budget.budgetCents, "TRY")} bütçesinden</p>

          <div className="mt-2 w-full">
            <div className="h-2.5 overflow-hidden rounded-full bg-surface-muted">
              <div className={`h-full rounded-full ${ALERT_BAR[budget.alertLevel]}`} style={{ width: `${Math.min(100, budget.percentUsed)}%` }} />
            </div>
          </div>

          <span
            className={`mt-1 rounded-full px-2.5 py-1 text-xs font-bold ${
              budget.alertLevel === "exceeded"
                ? "bg-danger-soft text-danger"
                : budget.alertLevel === "warning_80"
                  ? "bg-warning-soft text-warning"
                  : "bg-accent-soft text-accent"
            }`}
          >
            {ALERT_LABEL[budget.alertLevel]}
          </span>
        </div>

        <div className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-surface px-4">
          <div className="flex items-center justify-between py-3 first:pt-3.5">
            <span className="text-sm text-text-secondary">Kalan</span>
            <span className={`text-sm font-semibold ${remaining >= 0 ? "text-text-primary" : "text-danger"}`}>
              {remaining >= 0 ? formatCentsAsCurrency(remaining, "TRY") : `${formatCentsAsCurrency(Math.abs(remaining), "TRY")} aşıldı`}
            </span>
          </div>
          <div className="flex items-center justify-between py-3 last:pb-3.5">
            <span className="text-sm text-text-secondary">Kullanım oranı</span>
            <span className="text-sm font-semibold text-text-primary">%{Math.round(budget.percentUsed)}</span>
          </div>
        </div>

        {budget.categoryId === null ? (
          <p className="rounded-2xl bg-surface-muted p-3.5 text-xs text-text-muted">
            Bu, o ay/deftere ait TÜM giderleri kapsayan toplam bütçedir — kategori bazlı bütçelerin toplamından
            bağımsız, ayrı bir ölçümdür.
          </p>
        ) : null}

        {canManage ? (
          <Button variant="ghost" onClick={() => setConfirmOpen(true)} fullWidth={false} className="!text-danger">
            Bütçeyi iptal et
          </Button>
        ) : null}
      </div>

      <ConfirmModal
        open={confirmOpen}
        title="Bütçeyi iptal et"
        description="Bu bütçe iptal edilecek. Bu işlem geri alınamaz, ama geçmiş kayıt korunur."
        confirmLabel="İptal et"
        danger
        loading={loading}
        onConfirm={handleCancel}
        onCancel={() => setConfirmOpen(false)}
      />
    </AppShell>
  );
}
