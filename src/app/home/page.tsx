import type { SupabaseClient } from "@supabase/supabase-js";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { SpaceSwitcher } from "@/components/dashboard/SpaceSwitcher";
import { ProfileMenu } from "@/components/dashboard/ProfileMenu";
import { GreetingHeader } from "@/components/dashboard/GreetingHeader";
import { HomeSummaryCard } from "@/components/dashboard/HomeSummaryCard";
import { HomePeriodPicker } from "@/components/dashboard/HomePeriodPicker";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { DashboardCard, CardError, CardEmptyState, CardLink } from "@/components/dashboard/DashboardCard";
import { DebtList } from "@/components/dashboard/DebtListCard";
import { TransactionListItem } from "@/components/transactions/TransactionListItem";
import { BudgetListItem } from "@/components/budgets/BudgetListItem";
import { AiTeaserCard } from "@/components/dashboard/AiTeaserCard";
import { FlowCompare } from "@/components/charts/FlowCompare";
import { DonutChart, type DonutSegment } from "@/components/charts/DonutChart";
import { TrendChart, type TrendPoint } from "@/components/charts/TrendChart";
import { ClockIcon, ListIcon, PieChartIcon, TrendingUpIcon, PlusIcon, TransferIcon } from "@/components/icons";
import { resolveHomePeriod } from "@/lib/format/homePeriod";
import { categoryColor, CHART_SERIES } from "@/lib/format/categoryColor";
import { formatCentsAsCurrency } from "@/lib/format/amount";
import { getUserSpacesBasic, resolveActiveSpace } from "@/lib/dashboard/formData";
import { getProfileHeaderInfo } from "@/lib/avatars";
import { getTransactionHistory } from "@/lib/dashboard/transactionHistory";
import { getUnreadNotificationCount } from "@/lib/dashboard/notifications";
import { getBusinessSummary } from "@/lib/dashboard/business";
import { BusinessSummaryGrid } from "@/components/business/BusinessSummaryGrid";
import { NotificationBell } from "@/components/dashboard/NotificationBell";
import { getBudgets } from "@/lib/dashboard/budgets";
import { getExpenseByCategory, getMonthlyTrend, type CategoryBreakdownRow, type MonthlyTrendRow } from "@/lib/dashboard/reports";
import {
  getTotalBalanceByCurrency,
  getFlowForPeriod,
  getUpcomingDebts,
  getReceivablesSummary,
  type CurrencyAmount,
} from "@/lib/dashboard/queries";
import { getHoldings, computePortfolioTotals } from "@/lib/dashboard/investments";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ space?: string; period?: string; from?: string; to?: string }>;
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
      <GreetingHeader displayName={profileHeader.displayName} spaceName={activeSpace.name} spaceType={activeSpace.type} />

      <div className="mt-4 flex min-w-0 flex-col gap-4 pb-24 md:gap-5 md:pb-6">
        {activeSpace.type === "home" ? (
          <HomeDashboard
            supabase={supabase}
            bookId={activeSpace.bookId}
            spaceId={activeSpace.id}
            hasBusiness={hasBusiness}
            rawPeriod={params.period}
            rawFrom={params.from}
            rawTo={params.to}
          />
        ) : (
          <BusinessDashboard supabase={supabase} bookId={activeSpace.bookId} spaceId={activeSpace.id} />
        )}
      </div>
    </AppShell>
  );
}

/** En büyük 5 kategori + kalanlar "Diğer" olarak birleştirilir (toplam aynı kalır). */
function toDonutSegments(rows: CategoryBreakdownRow[]): DonutSegment[] {
  const top = rows.slice(0, 5);
  const rest = rows.slice(5).reduce((s, r) => s + r.totalCents, 0);
  const segments: DonutSegment[] = top.map((r, i) => ({
    key: r.categoryId ?? "__none__",
    label: r.categoryName,
    valueCents: r.totalCents,
    color: r.categoryId ? categoryColor(r.categoryId) : CHART_SERIES[i % CHART_SERIES.length],
  }));
  if (rest > 0) segments.push({ key: "__other__", label: "Diğer", valueCents: rest, color: "var(--chart-6)" });
  return segments;
}

function toTrendPoints(rows: MonthlyTrendRow[]): TrendPoint[] {
  return rows.map((r) => ({
    key: r.monthKey,
    label: r.monthLabel.split(" ")[0],
    fullLabel: r.monthLabel,
    incomeCents: r.incomeCents,
    expenseCents: r.expenseCents,
  }));
}

function tryCents(list: CurrencyAmount[]) {
  return list.find((a) => a.currency === "TRY")?.cents ?? 0;
}

async function HomeDashboard({
  supabase,
  bookId,
  spaceId,
  hasBusiness,
  rawPeriod,
  rawFrom,
  rawTo,
}: {
  supabase: SupabaseClient;
  bookId: string;
  spaceId: string;
  hasBusiness: boolean;
  rawPeriod?: string;
  rawFrom?: string;
  rawTo?: string;
}) {
  const period = resolveHomePeriod(rawPeriod, rawFrom, rawTo);

  const [balance, flow, prevFlow, budgets, upcoming, recent, receivables, holdings, categories, trend] = await Promise.allSettled([
    getTotalBalanceByCurrency(supabase, bookId),
    getFlowForPeriod(supabase, bookId, "month", period.range),
    getFlowForPeriod(supabase, bookId, "month", period.previous),
    getBudgets(supabase, bookId),
    getUpcomingDebts(supabase, bookId),
    getTransactionHistory(supabase, bookId, { limit: 5 }),
    getReceivablesSummary(supabase, bookId),
    getHoldings(supabase, bookId),
    getExpenseByCategory(supabase, bookId, "month", period.range),
    getMonthlyTrend(supabase, bookId, 6),
  ]);

  // "Toplam varlık" YALNIZCA TRY cinsinden hesap/alacak/yatırımların
  // toplamıdır — döviz cinsinden tutarlar SAHTE bir kur çevrimiyle bu
  // toplama ASLA karıştırılmaz (ayrı satırda gösterilir). Yatırım
  // değeri, güncel piyasa fiyatı VARSA güncel değeri, YOKSA maliyet
  // bazını kullanır (computePortfolioTotals ile AYNI mantık —
  // /investments sayfasındaki ile TUTARLIDIR).
  const balances = balance.status === "fulfilled" ? balance.value : [];
  const tryBalanceCents = tryCents(balances);
  const receivablesCents = receivables.status === "fulfilled" ? receivables.value.totalCents : 0;
  const holdingsList = holdings.status === "fulfilled" ? holdings.value : [];
  const tryPortfolioTotals = computePortfolioTotals(holdingsList.filter((h) => h.currency === "TRY"));
  const investmentsCents = tryPortfolioTotals.totalCurrentValueCents ?? tryPortfolioTotals.totalCostBasisCents;
  const totalAssetsCents = balance.status === "fulfilled" ? tryBalanceCents + receivablesCents + investmentsCents : null;

  const currentFlow =
    flow.status === "fulfilled" ? { incomeCents: tryCents(flow.value.income), expenseCents: tryCents(flow.value.expense) } : null;
  const previousFlow =
    prevFlow.status === "fulfilled"
      ? { incomeCents: tryCents(prevFlow.value.income), expenseCents: tryCents(prevFlow.value.expense) }
      : null;
  const otherCurrencyFlows =
    flow.status === "fulfilled"
      ? Array.from(new Set([...flow.value.income, ...flow.value.expense].map((a) => a.currency)))
          .filter((c) => c !== "TRY")
          .map((c) => ({
            currency: c,
            incomeCents: flow.value.income.find((a) => a.currency === c)?.cents ?? 0,
            expenseCents: flow.value.expense.find((a) => a.currency === c)?.cents ?? 0,
          }))
      : [];

  const categoryRows = categories.status === "fulfilled" ? categories.value : [];
  const topCategory = categoryRows[0];
  const categoryTotal = categoryRows.reduce((s, r) => s + r.totalCents, 0);
  const addExpenseHref = `/add-transaction?type=expense&book_id=${bookId}&space=${spaceId}`;
  const spaceQ = `space=${spaceId}`;

  return (
    <>
      <HomePeriodPicker active={period.period} from={period.from} to={period.to} />

      <div className="grid min-w-0 grid-cols-1 gap-4 md:gap-5 lg:grid-cols-3 lg:items-start">
        <div className="min-w-0 lg:col-span-2">
          <HomeSummaryCard
            totalAssetsCents={totalAssetsCents}
            breakdown={
              totalAssetsCents !== null
                ? [
                    { label: "Hesaplar", cents: tryBalanceCents },
                    { label: "Alacaklar", cents: receivablesCents },
                    { label: "Yatırımlar", cents: investmentsCents },
                  ]
                : []
            }
            otherCurrencyBalances={balances.filter((a) => a.currency !== "TRY")}
            hasAccounts={balance.status !== "fulfilled" || balances.length > 0}
            periodLabel={period.label}
            flow={currentFlow}
            previousFlow={previousFlow}
            otherCurrencyFlows={otherCurrencyFlows}
          />
        </div>

        <DashboardCard title="Gelir – gider" subtitle={period.label} icon={<TransferIcon size={16} />} delay={60}>
          {currentFlow === null ? (
            <CardError />
          ) : currentFlow.incomeCents === 0 && currentFlow.expenseCents === 0 ? (
            <CardEmptyState
              message="Bu dönemde hareket yok."
              hint="Gelir veya gider eklediğinde karşılaştırma burada görünecek."
              action={{ href: addExpenseHref, label: "İşlem ekle" }}
            />
          ) : (
            <FlowCompare incomeCents={currentFlow.incomeCents} expenseCents={currentFlow.expenseCents} />
          )}
        </DashboardCard>

        <DashboardCard
          title="Son işlemler"
          icon={<ListIcon size={16} />}
          action={<CardLink href={`/transactions?${spaceQ}`} />}
          className="lg:col-span-2"
          delay={90}
        >
          {recent.status === "fulfilled" ? (
            recent.value.rows.length === 0 ? (
              <CardEmptyState
                message="Henüz işlem eklemedin."
                hint="İlk gelir veya giderini ekleyerek başlayabilirsin."
                action={{ href: addExpenseHref, label: "İşlem ekle" }}
              />
            ) : (
              <div className="flex min-w-0 flex-col gap-2">
                {recent.value.rows.map((row) => (
                  <TransactionListItem key={row.entryId} row={row} spaceParam={spaceId} bookId={bookId} />
                ))}
              </div>
            )
          ) : (
            <CardError />
          )}
        </DashboardCard>

        <DashboardCard
          title="Harcama dağılımı"
          subtitle={
            topCategory && categoryTotal > 0
              ? `En çok: ${topCategory.categoryName} · %${Math.round((topCategory.totalCents / categoryTotal) * 100)}`
              : period.label
          }
          icon={<PieChartIcon size={16} />}
          action={<CardLink href={`/reports?${spaceQ}`}>Raporlar</CardLink>}
          delay={120}
        >
          {categories.status !== "fulfilled" ? (
            <CardError />
          ) : categoryRows.length === 0 ? (
            <CardEmptyState message="Bu dönemde gider yok." hint="Giderlerin kategorilere göre burada dağılacak." icon={<PieChartIcon size={20} />} />
          ) : (
            <DonutChart segments={toDonutSegments(categoryRows)} centerLabel="Toplam gider" />
          )}
        </DashboardCard>

        <DashboardCard
          title="Aylık trend"
          subtitle="Son 6 ay · gelir ve gider"
          icon={<TrendingUpIcon size={16} />}
          className="lg:col-span-2"
          delay={150}
        >
          {trend.status !== "fulfilled" ? (
            <CardError />
          ) : trend.value.every((r) => r.incomeCents === 0 && r.expenseCents === 0) ? (
            <CardEmptyState message="Henüz trend oluşacak kadar veri yok." hint="Birkaç ay boyunca işlem ekledikçe aylık değişimin burada görünecek." icon={<TrendingUpIcon size={20} />} />
          ) : (
            <TrendChart points={toTrendPoints(trend.value)} />
          )}
        </DashboardCard>

        <div className="flex min-w-0 flex-col gap-4 md:gap-5">
          <DashboardCard
            title="Bütçeler"
            subtitle="Bu ay"
            icon={<PieChartIcon size={16} />}
            action={<CardLink href={`/budgets?${spaceQ}`} />}
            delay={180}
          >
            {budgets.status !== "fulfilled" ? (
              <CardError />
            ) : budgets.value.length === 0 ? (
              <CardEmptyState
                message="Bu ay için bütçe yok."
                hint="Harcama sınırı belirleyerek ne kadar harcadığını takip edebilirsin."
                action={{ href: `/budgets/new?${spaceQ}`, label: "Bütçe oluştur" }}
              />
            ) : (
              <div className="flex min-w-0 flex-col gap-3">
                {budgets.value.slice(0, 3).map((b) => (
                  <BudgetListItem key={b.id} budget={b} spaceParam={spaceId} compact />
                ))}
                {budgets.value.length > 3 ? (
                  <Link href={`/budgets?${spaceQ}`} className="text-center text-xs font-semibold text-text-muted">
                    +{budgets.value.length - 3} bütçe daha
                  </Link>
                ) : null}
              </div>
            )}
          </DashboardCard>

          <DashboardCard
            title="Yaklaşan ödemeler"
            icon={<ClockIcon size={16} />}
            action={<CardLink href={`/debts?${spaceQ}`} />}
            delay={210}
          >
            {upcoming.status === "fulfilled" ? (
              <DebtList
                debts={upcoming.value}
                spaceParam={spaceId}
                emptyMessage="Yaklaşan ödeme yok."
                emptyHint="Vadesi gelen borç/alacak eklediğinde burada göreceksin."
              />
            ) : (
              <CardError />
            )}
          </DashboardCard>
        </div>
      </div>

      {!hasBusiness ? (
        <Link
          href="/spaces/new-business"
          className="surface-card flex min-w-0 items-center gap-3 rounded-3xl border-dashed p-4 transition-colors active:bg-surface-muted"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-balance-soft text-balance">
            <PlusIcon size={18} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-text-primary">Bir işletmen mi var?</p>
            <p className="text-xs text-text-muted">Ayrı bir İşletme alanı oluşturup gelir-giderini bağımsız takip et.</p>
          </div>
        </Link>
      ) : null}

      <AiTeaserCard />

      <QuickActions bookId={bookId} spaceParam={spaceId} />
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
  const month = resolveHomePeriod("month");
  const [summary, upcomingPayable, upcomingReceivable, recent, trend, categories] = await Promise.allSettled([
    getBusinessSummary(supabase, bookId),
    getUpcomingDebts(supabase, bookId, { direction: "payable" }),
    getUpcomingDebts(supabase, bookId, { direction: "receivable" }),
    getTransactionHistory(supabase, bookId, { limit: 5 }),
    getMonthlyTrend(supabase, bookId, 6),
    getExpenseByCategory(supabase, bookId, "month", month.range),
  ]);

  const spaceQ = `space=${spaceId}`;
  const categoryRows = categories.status === "fulfilled" ? categories.value : [];
  const topCategory = categoryRows[0];
  const categoryTotal = categoryRows.reduce((s, r) => s + r.totalCents, 0);

  return (
    <>
      <div className="grid min-w-0 grid-cols-1 gap-4 md:gap-5 lg:grid-cols-3 lg:items-start">
        <div className="min-w-0 lg:col-span-3">
          {summary.status === "fulfilled" ? (
            <BusinessSummaryGrid bookId={bookId} initialSummary={summary.value} />
          ) : (
            <DashboardCard title="İşletme özeti">
              <CardError />
            </DashboardCard>
          )}
        </div>

        <DashboardCard
          title="Son işlemler"
          icon={<ListIcon size={16} />}
          action={<CardLink href={`/transactions?${spaceQ}`} />}
          className="lg:col-span-2"
          delay={60}
        >
          {recent.status === "fulfilled" ? (
            recent.value.rows.length === 0 ? (
              <CardEmptyState
                message="Henüz işlem eklemedin."
                hint="İlk satış veya alışını sağ alttaki + butonundan ekleyebilirsin."
              />
            ) : (
              <div className="flex min-w-0 flex-col gap-2">
                {recent.value.rows.map((row) => (
                  <TransactionListItem key={row.entryId} row={row} spaceParam={spaceId} bookId={bookId} />
                ))}
              </div>
            )
          ) : (
            <CardError />
          )}
        </DashboardCard>

        <div className="flex min-w-0 flex-col gap-4 md:gap-5">
          <DashboardCard
            title="Yaklaşan ödemeler"
            icon={<ClockIcon size={16} />}
            action={<CardLink href={`/debts?${spaceQ}&direction=payable`} />}
            delay={90}
          >
            {upcomingPayable.status === "fulfilled" ? (
              <DebtList
                debts={upcomingPayable.value}
                spaceParam={spaceId}
                emptyMessage="Yaklaşan ödeme yok."
                emptyHint="Vadesi gelen borçların burada listelenecek."
              />
            ) : (
              <CardError />
            )}
          </DashboardCard>

          <DashboardCard
            title="Yaklaşan tahsilatlar"
            icon={<ClockIcon size={16} />}
            action={<CardLink href={`/debts?${spaceQ}&direction=receivable`} />}
            delay={120}
          >
            {upcomingReceivable.status === "fulfilled" ? (
              <DebtList
                debts={upcomingReceivable.value}
                spaceParam={spaceId}
                emptyMessage="Yaklaşan tahsilat yok."
                emptyHint="Vadesi gelen alacakların burada listelenecek."
              />
            ) : (
              <CardError />
            )}
          </DashboardCard>
        </div>

        <DashboardCard
          title="Aylık trend"
          subtitle="Son 6 ay · gelir ve gider"
          icon={<TrendingUpIcon size={16} />}
          className="lg:col-span-2"
          delay={150}
        >
          {trend.status !== "fulfilled" ? (
            <CardError />
          ) : trend.value.every((r) => r.incomeCents === 0 && r.expenseCents === 0) ? (
            <CardEmptyState message="Henüz trend oluşacak kadar veri yok." hint="Satış ve giderlerin aylık değişimi burada görünecek." icon={<TrendingUpIcon size={20} />} />
          ) : (
            <TrendChart points={toTrendPoints(trend.value)} />
          )}
        </DashboardCard>

        <DashboardCard
          title="Gider dağılımı"
          subtitle={
            topCategory && categoryTotal > 0
              ? `En çok: ${topCategory.categoryName} · %${Math.round((topCategory.totalCents / categoryTotal) * 100)}`
              : month.label
          }
          icon={<PieChartIcon size={16} />}
          action={<CardLink href={`/reports?${spaceQ}`}>Raporlar</CardLink>}
          delay={180}
        >
          {categories.status !== "fulfilled" ? (
            <CardError />
          ) : categoryRows.length === 0 ? (
            <CardEmptyState message="Bu ay gider yok." hint="Alış ve masrafların kategorilere göre burada dağılacak." icon={<PieChartIcon size={20} />} />
          ) : (
            <>
              <DonutChart segments={toDonutSegments(categoryRows)} centerLabel="Bu ay gider" />
              <p className="mt-3 text-center text-[11px] text-text-muted">
                Toplam {formatCentsAsCurrency(categoryTotal, "TRY")}
              </p>
            </>
          )}
        </DashboardCard>
      </div>

      <AiTeaserCard />

      <QuickActions bookId={bookId} spaceParam={spaceId} variant="business" />
    </>
  );
}
