import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { getGoal, getGoalContributions, monthlyNeededCents } from "@/lib/dashboard/goals";
import { getUserRoleForBook } from "@/lib/dashboard/formData";
import { formatCentsAsCurrency } from "@/lib/format/amount";
import { formatGoalDate } from "@/components/goals/GoalCard";
import { GoalActions } from "@/components/goals/GoalActions";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** İstek anındaki tarih (render dışında). */
function requestToday() {
  return new Date();
}

export default async function GoalDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ space?: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect("/welcome");

  const goal = await getGoal(supabase, id).catch(() => null);
  if (!goal) notFound();
  const { space } = await searchParams;
  const spaceQuery = space ? `?space=${space}` : "";

  const [contributions, role] = await Promise.all([
    getGoalContributions(supabase, id).catch(() => []),
    getUserRoleForBook(supabase, goal.bookId).catch(() => null),
  ]);
  const canEdit = role === "owner" || role === "admin" || role === "editor";

  const pct = Math.min(100, Math.round((goal.savedCents / goal.targetCents) * 100));
  const remaining = Math.max(0, goal.targetCents - goal.savedCents);
  const monthly = monthlyNeededCents(goal, requestToday());
  const achieved = goal.status === "achieved";
  const archived = goal.status === "archived";

  return (
    <AppShell variant="subpage" title={goal.name} parentHref={`/goals${spaceQuery}`}>
      <div className="flex flex-col gap-4 pt-3 pb-6">
        <section
          className="animate-rise relative overflow-hidden rounded-3xl border p-5"
          style={{ backgroundImage: "var(--gradient-hero)", borderColor: "color-mix(in srgb, var(--color-accent) 28%, var(--color-border))" }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-text-secondary">Biriken</p>
              <p className="text-3xl font-extrabold tabular-nums text-text-primary">{formatCentsAsCurrency(goal.savedCents, goal.currency)}</p>
              <p className="mt-0.5 text-sm tabular-nums text-text-secondary">/ {formatCentsAsCurrency(goal.targetCents, goal.currency)} hedef</p>
            </div>
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${achieved ? "bg-success-soft text-success" : archived ? "bg-surface-muted text-text-muted" : "bg-accent-soft text-accent"}`}>
              {achieved ? "Tamamlandı 🎉" : archived ? "Arşivlendi" : `%${pct}`}
            </span>
          </div>
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-surface-muted" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Hedef ilerlemesi">
            <div className={`animate-grow-x h-full rounded-full ${achieved ? "bg-success" : "bg-accent"}`} style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl bg-surface/70 px-3 py-2">
              <p className="text-text-muted">Kalan</p>
              <p className="font-bold tabular-nums text-text-primary">{formatCentsAsCurrency(remaining, goal.currency)}</p>
            </div>
            <div className="rounded-xl bg-surface/70 px-3 py-2">
              <p className="text-text-muted">{goal.targetDate ? "Hedef tarih" : "Tarih"}</p>
              <p className="font-bold text-text-primary">{goal.targetDate ? formatGoalDate(goal.targetDate) : "Belirlenmedi"}</p>
            </div>
          </div>
          {monthly !== null && !archived ? (
            <p className="mt-3 rounded-xl bg-accent-soft px-3 py-2 text-xs font-semibold text-accent">
              Hedefe zamanında ulaşmak için ayda yaklaşık {formatCentsAsCurrency(monthly, goal.currency)} ayırmalısın.
            </p>
          ) : null}
        </section>

        <GoalActions
          goalId={goal.id}
          status={goal.status}
          savedCents={goal.savedCents}
          currency={goal.currency}
          canEdit={canEdit}
          contributions={contributions}
        />

        {canEdit ? (
          <Link href={`/goals/${goal.id}/edit${spaceQuery}`} className="self-start text-sm font-semibold text-accent">
            Hedefi düzenle
          </Link>
        ) : null}
      </div>
    </AppShell>
  );
}
