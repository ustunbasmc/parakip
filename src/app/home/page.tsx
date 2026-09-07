import type { SupabaseClient } from "@supabase/supabase-js";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { SpaceSwitcher } from "@/components/dashboard/SpaceSwitcher";
import { ProfileMenu } from "@/components/dashboard/ProfileMenu";
import { GreetingHeader } from "@/components/dashboard/GreetingHeader";
import { HeroBalanceCard } from "@/components/dashboard/HeroBalanceCard";
import { MonthSummaryRow } from "@/components/dashboard/MonthSummaryRow";
import { PeriodSelector } from "@/components/dashboard/PeriodSelector";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { DashboardCard, CardError, CardEmptyState } from "@/components/dashboard/DashboardCard";
import { DebtList } from "@/components/dashboard/DebtListCard";
import { TransactionListItem } from "@/components/transactions/TransactionListItem";
import { BudgetProgress } from "@/components/dashboard/BudgetProgress";
import { PortfolioSummaryList } from "@/components/dashboard/PortfolioSummaryList";
import { AiTeaserCard } from "@/components/dashboard/AiTeaserCard";
import { ClockIcon, ListIcon, PieChartIcon, TrendingUpIcon, PlusIcon } from "@/components/icons";
import type { DashboardPeriod } from "@/lib/format/date";
import { PERIOD_LABELS } from "@/lib/format/date";
import { getUserSpacesBasic, resolveActiveSpace } from "@/lib/dashboard/formData";
import { getProfileHeaderInfo } from "@/lib/avatars";
import { getTransactionHistory } from "@/lib/dashboard/transactionHistory";
import { getUnreadNotificationCount } from "@/lib/dashboard/notifications";
import { getBusinessSummary } from "@/lib/dashboard/business";
import { BusinessSummaryGrid } from "@/components/business/BusinessSummaryGrid";
import { NotificationBell } from "@/components/dashboard/NotificationBell";
import {
  getTotalBalanceByCurrency,
  getFlowForPeriod,
  getTotalBudgetSummary,
  getUpcomingDebts,
  getPortfolioSummary,
  getReceivablesSummary,
} from "@/lib/dashboard/queries";
import { getHoldings, computePortfolioTotals } from "@/lib/dashboard/investments";



export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ space?: string; period?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));

  if (!user) {
    redirect("/welcome");
  }

  const [spaces, profileHeader] = await Promise.all([
    getUserSpacesBasic(supabase),
    getProfileHeaderInfo(supabase, user.id),
  ]);

  if (spaces.length === 0) {
    redirect("/onboarding/space-type");
  }

  let unreadCount = 0;
  try {
    unreadCount = await getUnreadNotificationCount(supabase);
  } catch {
    unreadCount = 0; // bildirimler yuklenemezse zil sessizce rozet gostermez
  }

  const params = await searchParams;
  const activeSpace = resolveActiveSpace(spaces, params.space);

  // "Yetkisiz bir space_id gönderilirse erişimi reddet ve güvenli bir
  // alana yönlendir": params.space verilmiş ama HİÇBİR erişilebilir alanla
  // eşleşmiyorsa (RLS zaten veriyi gizler, ama URL çubuğu hâlâ geçersiz id'yi
  // gösteriyor olurdu) — URL'yi de doğru/güvenli alana düzeltiyoruz.
  if (params.space && params.space !== activeSpace.id) {
    redirect(`/home?space=${activeSpace.id}`);
  }

  const hasBusiness = spaces.some((s) => s.type === "business");
  const VALID_PERIODS = new Set(["today", "week", "month", "year"]);
  const period = (VALID_PERIODS.has(params.period ?? "") ? params.period : "month") as DashboardPeriod;

  return (
    <AppShell
      activeSpaceType={activeSpace.type}
      headerEnd={
        <div className="flex items-center gap-2">
          <NotificationBell unreadCount={unreadCount} />
          <SpaceSwitcher
            options={spaces.map((s) => ({ id: s.id, type: s.type, name: s.name }))}
            activeId={activeSpace.id}
          />
          <ProfileMenu displayName={profileHeader.displayName} email={user.email ?? null} avatarUrl={profileHeader.avatarUrl} />
        </div>
      }
    >
      <GreetingHeader displayName={profileHeader.displayName} spaceName={activeSpace.name} />

      <div className="mt-4 flex flex-col gap-5 pb-4">
        {activeSpace.type === "home" ? (
          <HomeDashboard
            supabase={supabase}
            bookId={activeSpace.bookId}
            spaceId={activeSpace.id}
            hasBusiness={hasBusiness}
            period={period}
          />
        ) : (
          <BusinessDashboard supabase={supabase} bookId={activeSpace.bookId} spaceId={activeSpace.id} />
        )}
      </div>
    </AppShell>
  );
}

async function HomeDashboard({
  supabase,
  bookId,
  spaceId,
  hasBusiness,
  period,
}: {
  supabase: SupabaseClient;
  bookId: string;
  spaceId: string;
  hasBusiness: boolean;
  period: DashboardPeriod;
}) {
  const [balance, flow, budget, upcoming, recent, portfolio, receivables, holdings] = await Promise.allSettled([
    getTotalBalanceByCurrency(supabase, bookId),
    getFlowForPeriod(supabase, bookId, period),
    getTotalBudgetSummary(supabase, bookId),
    getUpcomingDebts(supabase, bookId),
    getTransactionHistory(supabase, bookId, { limit: 5 }),
    getPortfolioSummary(supabase, bookId),
    getReceivablesSummary(supabase, bookId),
    getHoldings(supabase, bookId),
  ]);

  // "Toplam varlık" YALNIZCA TRY cinsinden hesap/alacak/yatırımların
  // toplamıdır — döviz cinsinden tutarlar SAHTE bir kur çevrimiyle bu
  // toplama ASLA karıştırılmaz (bunlar zaten HeroBalanceCard'ın "amounts"
  // listesinde AYRI satırlar olarak gösterilmeye devam eder). Yatırım
  // değeri, güncel piyasa fiyatı VARSA güncel değeri, YOKSA maliyet
  // bazını kullanır (computePortfolioTotals ile AYNI, kanıtlanmış mantık
  // — /investments sayfasındaki ile TUTARLIDIR).
  const tryBalanceCents = balance.status === "fulfilled" ? (balance.value.find((a) => a.currency === "TRY")?.cents ?? 0) : 0;
  const receivablesCents = receivables.status === "fulfilled" ? receivables.value.totalCents : 0;
  const holdingsList = holdings.status === "fulfilled" ? holdings.value : [];
  const tryHoldings = holdingsList.filter((h) => h.currency === "TRY");
  const tryPortfolioTotals = computePortfolioTotals(tryHoldings);
  const investmentsCents = tryPortfolioTotals.totalCurrentValueCents ?? tryPortfolioTotals.totalCostBasisCents;
  const totalAssetsCents =
    balance.status === "fulfilled" ? tryBalanceCents + receivablesCents + investmentsCents : null;

  return (
    <>
      <HeroBalanceCard
        label="Toplam bakiye"
        amounts={balance.status === "fulfilled" ? balance.value : []}
        emptyMessage="Henüz hesap eklenmedi."
        emptyHint="İlk hesabını eklediğinde net durumun burada görünecek."
        totalAssetsCents={totalAssetsCents}
        breakdown={
          totalAssetsCents !== null
            ? [
                { label: "Hesaplar", cents: tryBalanceCents },
                { label: "Bekleyen alacaklar", cents: receivablesCents },
                { label: "Yatırımlar", cents: investmentsCents },
              ]
            : []
        }
      />

      <QuickActions bookId={bookId} spaceParam={spaceId} />

      <PeriodSelector active={period} />

      {flow.status === "fulfilled" ? (
        <MonthSummaryRow income={flow.value.income} expense={flow.value.expense} period={period} />
      ) : (
        <DashboardCard title={PERIOD_LABELS[period]}>
          <CardError />
        </DashboardCard>
      )}

      <div className="flex flex-col gap-5 lg:grid lg:grid-cols-3 lg:items-start lg:gap-5">
      <DashboardCard
        title="Son işlemler"
        icon={<ListIcon size={17} />}
        action={
          <Link href={`/transactions?space=${spaceId}`} className="text-xs font-semibold text-accent">
            Tümünü gör
          </Link>
        }
        className="lg:col-span-2"
      >
        {recent.status === "fulfilled" ? (
          recent.value.rows.length === 0 ? (
            <CardEmptyState
              message="Henüz işlem eklenmedi."
              hint="İlk gelir veya gider kaydını hızlı işlemlerden ekleyebilirsin."
            />
          ) : (
            <div className="flex flex-col gap-2">
              {recent.value.rows.map((row) => (
                <TransactionListItem key={row.entryId} row={row} spaceParam={spaceId} />
              ))}
            </div>
          )
        ) : (
          <CardError />
        )}
      </DashboardCard>

      <div className="flex flex-col gap-5">
      <DashboardCard
        title="Yaklaşan ödemeler"
        icon={<ClockIcon size={17} />}
        action={
          <Link href={`/debts?space=${spaceId}`} className="text-xs font-semibold text-accent">
            Tümünü gör
          </Link>
        }
      >
        {upcoming.status === "fulfilled" ? (
          <DebtList
            debts={upcoming.value}
            emptyMessage="Yaklaşan ödeme yok."
            emptyHint="Vadesi gelen borç/alacak eklediğinde burada göreceksin."
          />
        ) : (
          <CardError />
        )}
      </DashboardCard>

      <DashboardCard
        title="Kalan bütçe özeti"
        icon={<PieChartIcon size={17} />}
        action={
          <Link href={`/budgets?space=${spaceId}`} className="text-xs font-semibold text-accent">
            Tümünü gör
          </Link>
        }
      >
        {budget.status === "fulfilled" ? <BudgetProgress summary={budget.value} /> : <CardError />}
      </DashboardCard>

      <DashboardCard
        title="Yatırım portföyü özeti"
        icon={<TrendingUpIcon size={17} />}
        action={
          <Link href={`/investments?space=${spaceId}`} className="text-xs font-semibold text-accent">
            Tümünü gör
          </Link>
        }
      >
        {portfolio.status === "fulfilled" ? <PortfolioSummaryList rows={portfolio.value} /> : <CardError />}
      </DashboardCard>
      </div>
      </div>

      {!hasBusiness ? (
        <Link
          href="/spaces/new-business"
          className="flex items-center gap-3 rounded-2xl border border-dashed border-border-strong bg-surface p-4 transition-colors active:bg-surface-muted"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
            <PlusIcon size={18} />
          </span>
          <div>
            <p className="text-sm font-semibold text-text-primary">Bir işletmen mi var?</p>
            <p className="text-xs text-text-muted">Ayrı bir İşletme alanı oluşturup gelir-giderini bağımsız takip et.</p>
          </div>
        </Link>
      ) : null}

      <AiTeaserCard />
    </>
  );
}

async function BusinessDashboard({
  supabase,
  bookId,
  spaceId,
}: {
  supabase: SupabaseClient;
  bookId: string;
  spaceId: string;
}) {
  const [summary, upcomingPayable, upcomingReceivable, recent] = await Promise.allSettled([
    getBusinessSummary(supabase, bookId),
    getUpcomingDebts(supabase, bookId, { direction: "payable" }),
    getUpcomingDebts(supabase, bookId, { direction: "receivable" }),
    getTransactionHistory(supabase, bookId, { limit: 5 }),
  ]);

  return (
    <>
      {summary.status === "fulfilled" ? (
        <BusinessSummaryGrid bookId={bookId} initialSummary={summary.value} />
      ) : (
        <DashboardCard title="İşletme özeti">
          <CardError />
        </DashboardCard>
      )}

      <QuickActions bookId={bookId} spaceParam={spaceId} variant="business" />

      <div className="flex flex-col gap-5 lg:grid lg:grid-cols-3 lg:items-start lg:gap-5">
      <DashboardCard
        title="Son işlemler"
        icon={<ListIcon size={17} />}
        action={
          <Link href={`/transactions?space=${spaceId}`} className="text-xs font-semibold text-accent">
            Tümünü gör
          </Link>
        }
        className="lg:col-span-2"
      >
        {recent.status === "fulfilled" ? (
          recent.value.rows.length === 0 ? (
            <CardEmptyState
              message="Henüz işlem eklenmedi."
              hint="İlk satış veya alışını hızlı işlemlerden ekleyebilirsin."
            />
          ) : (
            <div className="flex flex-col gap-2">
              {recent.value.rows.map((row) => (
                <TransactionListItem key={row.entryId} row={row} spaceParam={spaceId} />
              ))}
            </div>
          )
        ) : (
          <CardError />
        )}
      </DashboardCard>

      <div className="flex flex-col gap-5">
      <DashboardCard
        title="Yaklaşan ödemeler"
        icon={<ClockIcon size={17} />}
        action={
          <Link href={`/debts?space=${spaceId}&direction=payable`} className="text-xs font-semibold text-accent">
            Tümünü gör
          </Link>
        }
      >
        {upcomingPayable.status === "fulfilled" ? (
          <DebtList
            debts={upcomingPayable.value}
            emptyMessage="Yaklaşan ödeme yok."
            emptyHint="Vadesi gelen borçların burada listelenecek."
          />
        ) : (
          <CardError />
        )}
      </DashboardCard>

      <DashboardCard
        title="Yaklaşan tahsilatlar"
        action={
          <Link href={`/debts?space=${spaceId}&direction=receivable`} className="text-xs font-semibold text-accent">
            Tümünü gör
          </Link>
        }
      >
        {upcomingReceivable.status === "fulfilled" ? (
          <DebtList
            debts={upcomingReceivable.value}
            emptyMessage="Yaklaşan tahsilat yok."
            emptyHint="Vadesi gelen alacakların burada listelenecek."
          />
        ) : (
          <CardError />
        )}
      </DashboardCard>
      </div>
      </div>

      <AiTeaserCard />
    </>
  );
}
