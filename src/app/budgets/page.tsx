import { NewBudgetButton } from "@/components/budgets/NewBudgetButton";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { SpaceSwitcher } from "@/components/dashboard/SpaceSwitcher";
import { ProfileMenu } from "@/components/dashboard/ProfileMenu";
import { NotificationBell } from "@/components/dashboard/NotificationBell";
import { CardEmptyState } from "@/components/dashboard/DashboardCard";
import { BudgetListItem } from "@/components/budgets/BudgetListItem";

import { getUserSpacesBasic, resolveActiveSpace } from "@/lib/dashboard/formData";
import { getUnreadNotificationCount } from "@/lib/dashboard/notifications";
import { getProfileHeaderInfo } from "@/lib/avatars";
import { getBudgets } from "@/lib/dashboard/budgets";

export default async function BudgetsPage({ searchParams }: { searchParams: Promise<{ space?: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
  if (!user) redirect("/welcome");

  const profileHeader = await getProfileHeaderInfo(supabase, user.id);

  const spaces = await getUserSpacesBasic(supabase);
  if (spaces.length === 0) redirect("/onboarding/space-type");

  const params = await searchParams;
  const activeSpace = resolveActiveSpace(spaces, params.space);
  if (params.space && params.space !== activeSpace.id) {
    redirect(`/budgets?space=${activeSpace.id}`);
  }

  let unreadCount = 0;
  try {
    unreadCount = await getUnreadNotificationCount(supabase);
  } catch {
    unreadCount = 0;
  }

  let budgets;
  let loadError = false;
  try {
    budgets = await getBudgets(supabase, activeSpace.bookId);
  } catch {
    loadError = true;
    budgets = [] as Awaited<ReturnType<typeof getBudgets>>;
  }

  const now = new Date();
  const monthLabel = new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric" }).format(now);

  return (
    <AppShell
      title="Bütçeler"
      activeSpaceType={activeSpace.type}
      headerEnd={
        <div className="flex items-center gap-2">
          <NotificationBell unreadCount={unreadCount} />
          <SpaceSwitcher options={spaces.map((s) => ({ id: s.id, type: s.type, name: s.name }))} activeId={activeSpace.id} />
          <ProfileMenu displayName={profileHeader.displayName} email={user.email ?? null} avatarUrl={profileHeader.avatarUrl} />
        </div>
      }
    >
      <div className="flex flex-col gap-4 pt-2 pb-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-text-secondary">{monthLabel}</p>
          <NewBudgetButton bookId={activeSpace.bookId} spaceParam={activeSpace.id} />
        </div>

        {loadError ? (
          <p className="py-6 text-center text-sm text-danger">Bütçeler yüklenemedi. Lütfen tekrar dene.</p>
        ) : budgets.length === 0 ? (
          <CardEmptyState message="Bu ay için henüz bütçe belirlenmedi." hint="Sağ üstteki + ile ilk bütçeni oluşturabilirsin." />
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {budgets.map((b) => (
              <BudgetListItem key={b.id} budget={b} spaceParam={activeSpace.id} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
