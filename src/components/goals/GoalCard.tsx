import Link from "next/link";
import { formatCentsAsCurrency } from "@/lib/format/amount";
import type { GoalRow } from "@/lib/dashboard/goals";

const dateFmt = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export function formatGoalDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return dateFmt.format(new Date(Date.UTC(y, m - 1, d)));
}

/** Hedef kartı: ad, ilerleme çubuğu, biriken / hedef ve durum. */
export function GoalCard({ goal, spaceParam }: { goal: GoalRow; spaceParam: string }) {
  const pct = goal.targetCents > 0 ? Math.min(100, Math.round((goal.savedCents / goal.targetCents) * 100)) : 0;
  const achieved = goal.status === "achieved";
  const archived = goal.status === "archived";
  return (
    <Link
      href={`/goals/${goal.id}?space=${spaceParam}`}
      className={`surface-card flex min-w-0 flex-col gap-3 rounded-3xl p-4 transition-colors hover:bg-surface-muted/60 ${archived ? "opacity-70" : ""}`}
    >
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-bold text-text-primary">{goal.name}</p>
          <p className="truncate text-xs text-text-muted">{goal.targetDate ? `Hedef tarih: ${formatGoalDate(goal.targetDate)}` : "Tarih belirlenmedi"}</p>
        </div>
        {achieved ? (
          <span className="shrink-0 rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-bold text-success">Tamamlandı</span>
        ) : archived ? (
          <span className="shrink-0 rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-bold text-text-muted">Arşiv</span>
        ) : (
          <span className="shrink-0 text-sm font-extrabold tabular-nums text-accent">%{pct}</span>
        )}
      </div>
      <div
        className="h-2.5 overflow-hidden rounded-full bg-surface-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label={`${goal.name} ilerlemesi`}
      >
        <div className={`h-full rounded-full ${achieved ? "bg-success" : "bg-accent"}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-sm tabular-nums text-text-secondary">
        <span className="font-bold text-text-primary">{formatCentsAsCurrency(goal.savedCents, goal.currency)}</span> /{" "}
        {formatCentsAsCurrency(goal.targetCents, goal.currency)}
      </p>
    </Link>
  );
}
