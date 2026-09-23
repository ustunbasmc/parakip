import { formatCentsAsCurrency } from "@/lib/format/amount";
import { formatDueDateLabel } from "@/lib/format/date";
import { AlertIcon } from "@/components/icons";
import type { CashFlowSummary } from "@/lib/dashboard/debts";

/**
 * Nakit akışı özeti: toplam açık borç, toplam açık alacak, net pozisyon,
 * vadesi geçmiş ve önümüzdeki 30 gün içindeki kalemler. debt_balances
 * view'ından türetilir — ayrı bir hesaplama/ledger mantığı YOKTUR.
 * Borç/alacak oranı yalnızca görsel bir "denge çubuğu" olarak gösterilir.
 */
export function CashFlowSummaryCard({ summary }: { summary: CashFlowSummary }) {
  const { totalPayableRemainingCents, totalReceivableRemainingCents, netCents, overdue, upcoming } = summary;
  const total = totalPayableRemainingCents + totalReceivableRemainingCents;
  const receivableShare = total > 0 ? (totalReceivableRemainingCents / total) * 100 : 0;

  return (
    <section
      aria-label="Borç ve alacak özeti"
      className="animate-rise relative overflow-hidden rounded-3xl border p-4 sm:p-5"
      style={{
        backgroundImage: "var(--gradient-hero)",
        boxShadow: "var(--shadow-hero)",
        borderColor: "color-mix(in srgb, var(--color-accent) 28%, var(--color-border))",
      }}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Net pozisyon</p>
      <p className={`mt-1 break-words text-3xl font-extrabold tabular-nums ${netCents >= 0 ? "text-income" : "text-expense"}`}>
        {netCents >= 0 ? "+" : "−"}
        {formatCentsAsCurrency(Math.abs(netCents), "TRY")}
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="min-w-0 rounded-2xl bg-[var(--tile-bg)] p-3 backdrop-blur-sm">
          <p className="text-[11px] font-semibold text-text-secondary">Toplam alacak</p>
          <p className="truncate text-base font-extrabold tabular-nums text-income">
            {formatCentsAsCurrency(totalReceivableRemainingCents, "TRY")}
          </p>
        </div>
        <div className="min-w-0 rounded-2xl bg-[var(--tile-bg)] p-3 backdrop-blur-sm">
          <p className="text-[11px] font-semibold text-text-secondary">Toplam borç</p>
          <p className="truncate text-base font-extrabold tabular-nums text-expense">
            {formatCentsAsCurrency(totalPayableRemainingCents, "TRY")}
          </p>
        </div>
      </div>

      {total > 0 ? (
        <div className="mt-3">
          <div className="flex h-2 w-full overflow-hidden rounded-full bg-surface-muted" aria-hidden="true">
            <div className="animate-grow-x h-full bg-income" style={{ width: `${receivableShare}%` }} />
            <div className="h-full flex-1 bg-expense" />
          </div>
          <p className="mt-1.5 text-[11px] text-text-muted">
            Açık kayıtların %{Math.round(receivableShare)}&apos;i alacak, %{100 - Math.round(receivableShare)}&apos;i borç.
          </p>
        </div>
      ) : null}

      {overdue.length > 0 ? (
        <div className="mt-3.5 flex items-start gap-2 rounded-2xl bg-danger-soft p-3 text-danger">
          <AlertIcon size={16} className="mt-0.5 shrink-0" />
          <p className="text-xs font-semibold">
            {overdue.length} vadesi geçmiş kayıt: {overdue.slice(0, 2).map((d) => d.counterpartyName).join(", ")}
            {overdue.length > 2 ? "…" : ""}
          </p>
        </div>
      ) : null}

      {upcoming.length > 0 ? (
        <div className="mt-3.5">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-muted">Önümüzdeki 30 gün</p>
          <div className="flex flex-col gap-1.5">
            {upcoming.slice(0, 3).map((d) => (
              <div key={d.id} className="flex min-w-0 items-center justify-between gap-2 rounded-xl bg-[var(--tile-bg)] px-3 py-2 text-xs">
                <span className="min-w-0 truncate text-text-secondary">
                  {d.counterpartyName} · <span className="text-text-muted">{formatDueDateLabel(d.dueDate!)}</span>
                </span>
                <span className={`shrink-0 font-bold tabular-nums ${d.direction === "payable" ? "text-expense" : "text-income"}`}>
                  {formatCentsAsCurrency(d.remainingCents, "TRY")}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
