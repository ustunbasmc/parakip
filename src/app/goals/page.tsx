import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { SpaceSwitcher } from "@/components/dashboard/SpaceSwitcher";
import { ProfileMenu } from "@/components/dashboard/ProfileMenu";
import { NotificationBell } from "@/components/dashboard/NotificationBell";
import { CardEmptyState } from "@/components/dashboard/DashboardCard";
import { GoalCard } from "@/components/goals/GoalCard";
import { PlusIcon } from "@/components/icons";
import { getUserSpacesBasic, resolveActiveSpace } from "@/lib/dashboard/formData";
import { getUnreadNotificationCount } from "@/lib/dashboard/notifications";
import { getProfileHeaderInfo } from "@/lib/avatars";
import { getGoalQuota, getGoals } from "@/lib/dashboard/goals";
import { formatCentsAsCurrency } from "@/lib/format/amount";

export default async function GoalsPage({ searchParams }: { searchParams: Promise<{ space?: string }> }) {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect("/welcome");

  const [profileHeader, spaces] = await Promise.all([getProfileHeaderInfo(supabase, user.id), getUserSpacesBasic(supabase)]);
  if (spaces.length === 0) redirect("/onboarding/space-type");

  const params = await searchParams;
  const activeSpace = resolveActiveSpace(spaces, params.space);
  if (params.space && params.space !== activeSpace.id) redirect(`/goals?space=${activeSpace.id}`);

  const [unreadCount, goalsResult, quota] = await Promise.all([
    getUnreadNotificationCount(supabase).catch(() => 0),
    getGoals(supabase, activeSpace.bookId)
      .then((goals) => ({ goals, error: false }))
      .catch(() => ({ goals: [], error: true })),
    getGoalQuota(supabase, activeSpace.bookId),
  ]);
  const { goals, error } = goalsResult;

  const open = goals.filter((g) => g.status !== "archived");
  const archived = goals.filter((g) => g.status === "archived");
  const totalSaved = open.reduce((s, g) => s + g.savedCents, 0);
  const totalTarget = open.reduce((s, g) => s + g.targetCents, 0);
  const atLimit = quota !== null && quota.limit !== null && quota.used >= quota.limit;
  const newHref = `/goals/new?book_id=${activeSpace.bookId}&space=${activeSpace.id}`;

  return (
    <AppShell
      title="Hedefler"
      activeSpaceType={activeSpace.type}
      helpSlug="birikim-hedefi-nasil-olusturulur"
      headerEnd={
        <div className="flex items-center gap-2">
          <NotificationBell unreadCount={unreadCount} />
          <SpaceSwitcher options={spaces.map((s) => ({ id: s.id, type: s.type, name: s.name }))} activeId={activeSpace.id} />
          <ProfileMenu displayName={profileHeader.displayName} email={user.email ?? null} avatarUrl={profileHeader.avatarUrl} />
        </div>
      }
    >
      <div className="flex flex-col gap-4 pt-2 pb-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            {open.length > 0 ? (
              <p className="text-sm text-text-secondary">
                Toplam birikim{" "}
                <span className="font-bold tabular-nums text-text-primary">{formatCentsAsCurrency(totalSaved, "TRY")}</span> /{" "}
                {formatCentsAsCurrency(totalTarget, "TRY")}
              </p>
            ) : (
              <p className="text-sm text-text-secondary">Tatil, araba veya acil durum fonu için hedef koy.</p>
            )}
          </div>
          {!atLimit ? (
            <Link href={newHref} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-text-on-accent" aria-label="Yeni hedef">
              <PlusIcon size={18} />
            </Link>
          ) : null}
        </div>

        {atLimit ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-dashed border-border-strong px-4 py-3">
            <p className="text-xs text-text-secondary">
              Ücretsiz planda {quota?.limit} aktif hedef tutabilirsin. Yeni hedef için mevcut hedefi arşivle ya da Premium&apos;a geç.
            </p>
            <Link href={`/settings/plan?space=${activeSpace.id}`} className="text-xs font-bold text-accent">
              Premium&apos;u incele
            </Link>
          </div>
        ) : null}

        {error ? (
          <p className="py-6 text-center text-sm text-danger">Hedefler yüklenemedi. Lütfen tekrar dene.</p>
        ) : open.length === 0 && archived.length === 0 ? (
          <div className="surface-card rounded-3xl p-2">
            <CardEmptyState
              message="Henüz birikim hedefin yok."
              hint="Bir hedef koy, biriktirdikçe ekle; hedefe ne kadar kaldığını ve ayda ne kadar ayırman gerektiğini gösterelim."
              action={{ href: newHref, label: "İlk hedefini oluştur" }}
            />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {open.map((g) => (
                <GoalCard key={g.id} goal={g} spaceParam={activeSpace.id} />
              ))}
            </div>
            {archived.length > 0 ? (
              <details className="rounded-2xl border border-border bg-surface px-4 py-3">
                <summary className="cursor-pointer text-sm font-semibold text-text-secondary">Arşivlenmiş hedefler ({archived.length})</summary>
                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {archived.map((g) => (
                    <GoalCard key={g.id} goal={g} spaceParam={activeSpace.id} />
                  ))}
                </div>
              </details>
            ) : null}
          </>
        )}
      </div>
    </AppShell>
  );
}
