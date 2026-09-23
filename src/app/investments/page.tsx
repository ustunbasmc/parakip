import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { SpaceSwitcher } from "@/components/dashboard/SpaceSwitcher";
import { ProfileMenu } from "@/components/dashboard/ProfileMenu";
import { NotificationBell } from "@/components/dashboard/NotificationBell";
import { CardEmptyState } from "@/components/dashboard/DashboardCard";
import { HoldingListItem } from "@/components/investments/HoldingListItem";
import { PortfolioSummaryCard } from "@/components/investments/PortfolioSummaryCard";
import { InvestmentActionButtons } from "@/components/investments/InvestmentActionButtons";
import { getUserSpacesBasic, resolveActiveSpace } from "@/lib/dashboard/formData";
import { getUnreadNotificationCount } from "@/lib/dashboard/notifications";
import { getProfileHeaderInfo } from "@/lib/avatars";
import { getHoldings, computePortfolioTotals } from "@/lib/dashboard/investments";

export default async function InvestmentsPage({ searchParams }: { searchParams: Promise<{ space?: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
  if (!user) redirect("/welcome");

  const [profileHeader, spaces] = await Promise.all([
    getProfileHeaderInfo(supabase, user.id),
    getUserSpacesBasic(supabase),
  ]);
  if (spaces.length === 0) redirect("/onboarding/space-type");

  const params = await searchParams;
  const activeSpace = resolveActiveSpace(spaces, params.space);
  if (params.space && params.space !== activeSpace.id) {
    redirect(`/investments?space=${activeSpace.id}`);
  }

  let unreadCount = 0;
  try {
    unreadCount = await getUnreadNotificationCount(supabase);
  } catch {
    unreadCount = 0;
  }

  let holdings;
  let loadError = false;
  try {
    holdings = await getHoldings(supabase, activeSpace.bookId);
  } catch {
    loadError = true;
    holdings = [] as Awaited<ReturnType<typeof getHoldings>>;
  }

  const totals = computePortfolioTotals(holdings);
  const primaryCurrency = holdings[0]?.currency ?? "TRY";

  return (
    <AppShell
      helpSlug="yatirim-islemi-nasil-eklenir"
      title="Yatırımlar"
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
        {loadError ? (
          <p className="py-6 text-center text-sm text-danger">Yatırımlar yüklenemedi. Lütfen tekrar dene.</p>
        ) : (
          <>
            <PortfolioSummaryCard totals={totals} currency={primaryCurrency} holdings={holdings} />

            <InvestmentActionButtons bookId={activeSpace.bookId} spaceParam={activeSpace.id} holdings={holdings} />

            {holdings.length === 0 ? (
              <div className="surface-card rounded-3xl p-2">
                <CardEmptyState
                  message="Henüz yatırımın yok."
                  hint="Hisse, altın, döviz veya kripto alışlarını kaydederek portföyünü takip edebilirsin."
                  action={{ href: `/investments/buy?book_id=${activeSpace.bookId}&space=${activeSpace.id}`, label: "İlk alışı ekle" }}
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 lg:grid-cols-3">
                {holdings.map((h) => (
                  <HoldingListItem key={h.id} holding={h} spaceParam={activeSpace.id} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
