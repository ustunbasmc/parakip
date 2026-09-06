"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatCentsAsCurrency } from "@/lib/format/amount";
import { formatDueDateLabel } from "@/lib/format/date";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { ErrorBanner } from "@/components/ErrorBanner";
import { ConfirmModal } from "@/components/ConfirmModal";
import { CardEmptyState } from "@/components/dashboard/DashboardCard";
import { ArchiveIcon, LockIcon } from "@/components/icons";
import type { PartyDetail } from "@/lib/dashboard/customers";

type PartyType = "customer" | "supplier";

const STATUS_LABEL: Record<string, string> = { open: "Açık", partial: "Kısmi ödendi", paid: "Ödendi", cancelled: "İptal edildi" };

/**
 * Fiziksel silme YOKTUR — yalnızca arşivleme (is_archived toggle, doğrudan
 * RLS'e tabi UPDATE ile — customers_update_editor_plus/suppliers_update_
 * editor_plus, bkz. migration 0051).
 */
export function PartyDetailView({
  type,
  party,
  spaceParam,
  backHref,
}: {
  type: PartyType;
  party: PartyDetail;
  spaceParam: string;
  backHref: string;
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const table = type === "customer" ? "customers" : "suppliers";
  const totalLabel = type === "customer" ? "Toplam satış" : "Toplam alış";
  const paidLabel = type === "customer" ? "Tahsil edilen" : "Ödenen";
  const debtHrefBase = "/debts";

  async function handleArchiveToggle() {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from(table)
      .update({ is_archived: !party.isArchived })
      .eq("id", party.id);
    setLoading(false);
    setConfirmOpen(false);
    if (updateError) {
      setError("İşlem gerçekleştirilemedi.");
      return;
    }
    router.refresh();
  }

  return (
    <AppShell variant="subpage" title={type === "customer" ? "Müşteri detayı" : "Tedarikçi detayı"} backFallbackHref={backHref}>
      <div className="flex flex-col gap-5 pt-3 pb-4">
        {error ? <ErrorBanner message={error} /> : null}

        <div className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-surface p-6 text-center">
          <p className="text-lg font-bold text-text-primary">{party.name}</p>
          <p className="text-sm text-text-muted">
            {party.phone || "Telefon yok"}
            {party.email ? ` · ${party.email}` : ""}
          </p>
          {party.isArchived ? (
            <span className="rounded-full bg-surface-muted px-2.5 py-1 text-xs font-bold text-text-muted">Arşivlenmiş</span>
          ) : null}
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-2xl border border-border bg-surface p-3">
            <p className="text-xs text-text-muted">{totalLabel}</p>
            <p className="mt-1 truncate text-base font-bold tabular-nums text-text-primary">
              {formatCentsAsCurrency(party.totalCents, "TRY")}
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-surface p-3">
            <p className="text-xs text-text-muted">{paidLabel}</p>
            <p className="mt-1 truncate text-base font-bold tabular-nums text-success">
              {formatCentsAsCurrency(party.paidCents, "TRY")}
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-surface p-3">
            <p className="text-xs text-text-muted">Bekleyen</p>
            <p className="mt-1 truncate text-base font-bold tabular-nums text-danger">
              {formatCentsAsCurrency(party.pendingCents, "TRY")}
            </p>
          </div>
        </div>

        {party.note ? (
          <div className="rounded-2xl border border-border bg-surface p-4">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">Not</p>
            <p className="text-sm text-text-primary">{party.note}</p>
          </div>
        ) : null}

        <Button variant="secondary" onClick={() => setConfirmOpen(true)} loading={loading} fullWidth={false}>
          <ArchiveIcon size={16} />
          {party.isArchived ? "Arşivden çıkar" : "Arşivle"}
        </Button>

        <section>
          <p className="mb-2 text-sm font-semibold text-text-secondary">
            {type === "customer" ? "Bağlı satışlar/alacaklar" : "Bağlı alışlar/borçlar"}
          </p>
          {party.debts.length === 0 ? (
            <CardEmptyState message={type === "customer" ? "Henüz satış kaydı yok." : "Henüz alış kaydı yok."} />
          ) : (
            <div className="flex flex-col gap-2">
              {party.debts.map((d) => (
                <a
                  key={d.id}
                  href={`${debtHrefBase}/${d.id}?space=${spaceParam}`}
                  className="flex items-center justify-between rounded-2xl border border-border bg-surface p-3.5"
                >
                  <div>
                    <p className="text-sm font-semibold text-text-primary">{STATUS_LABEL[d.status] ?? d.status}</p>
                    {d.dueDate ? <p className="text-xs text-text-muted">Vade: {formatDueDateLabel(d.dueDate)}</p> : null}
                  </div>
                  <p className="text-sm font-bold tabular-nums text-text-primary">
                    {formatCentsAsCurrency(d.remainingCents, "TRY")}
                  </p>
                </a>
              ))}
            </div>
          )}
        </section>

        <div className="flex items-start gap-2 rounded-2xl bg-surface-muted p-3.5 text-xs text-text-muted">
          <LockIcon size={14} className="mt-0.5 shrink-0" />
          <p>{type === "customer" ? "Müşteri" : "Tedarikçi"} kayıtları fiziksel olarak silinmez — yalnızca arşivlenebilir.</p>
        </div>
      </div>

      <ConfirmModal
        open={confirmOpen}
        title={party.isArchived ? "Arşivden çıkar" : "Arşivle"}
        description={
          party.isArchived
            ? `"${party.name}" tekrar aktif hale gelecek.`
            : `"${party.name}" arşivlendiğinde satış/alış formlarında görünmeyecek, ama tüm geçmiş kayıtlar korunur.`
        }
        confirmLabel={party.isArchived ? "Arşivden çıkar" : "Arşivle"}
        loading={loading}
        onConfirm={handleArchiveToggle}
        onCancel={() => setConfirmOpen(false)}
      />
    </AppShell>
  );
}
