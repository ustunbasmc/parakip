import type { SupabaseClient } from "@supabase/supabase-js";
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { SpaceSwitcher } from "@/components/dashboard/SpaceSwitcher";
import { ProfileMenu } from "@/components/dashboard/ProfileMenu";
import { GreetingHeader } from "@/components/dashboard/GreetingHeader";
import { BalanceHeroCard } from "@/components/dashboard/BalanceHeroCard";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { HomePeriodPicker } from "@/components/dashboard/HomePeriodPicker";
import { InsightsPanel } from "@/components/dashboard/InsightsPanel";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { DashboardCard, CardError, CardEmptyState, CardLink } from "@/components/dashboard/DashboardCard";
import { DebtList } from "@/components/dashboard/DebtListCard";
import { TransactionListItem } from "@/components/transactions/TransactionListItem";
import { BudgetListItem } from "@/components/budgets/BudgetListItem";
import { NotificationBell } from "@/components/dashboard/NotificationBell";
import { BusinessSummaryGrid } from "@/components/business/BusinessSummaryGrid";
import { DonutChart } from "@/components/charts/DonutChart";
import { TrendChart } from "@/components/charts/TrendChart";
import { DeltaBadge } from "@/components/ui/DeltaBadge";
import { CardSkeleton } from "@/components/ui/CardSkeleton";
import {
  ArrowUpRightIcon,
  ArrowDownRightIcon,
  ClockIcon,
  ListIcon,
  PieChartIcon,
  TrendingUpIcon,
  PlusIcon,
} from "@/components/icons";
import { resolveHomePeriod, type ResolvedHomePeriod } from "@/lib/format/homePeriod";
import { toDonutSegments, toTrendPoints, topCategoryLabel } from "@/lib/format/chartData";
import { formatCentsAsCurrency } from "@/lib/format/amount";
import { getUserSpacesBasic, resolveActiveSpace } from "@/lib/dashboard/formData";
import { getProfileHeaderInfo } from "@/lib/avatars";
import { getTransactionHistory } from "@/lib/dashboard/transactionHistory";
import { getUnreadNotificationCount } from "@/lib/dashboard/notifications";
import { getBusinessSummary } from "@/lib/dashboard/business";
import { getBudgets } from "@/lib/dashboard/budgets";
import { getExpenseByCategory, getMonthlyTrend } from "@/lib/dashboard/reports";
import { getFlowForPeriod, getUpcomingDebts, getReceivablesSummary, type CurrencyAmount } from "@/lib/dashboard/queries";
import { computePortfolioTotals } from "@/lib/dashboard/investments";
import { getBalancesCached, getHoldingsCached } from "@/lib/dashboard/homeData";
import { getMonthSummary } from "@/lib/dashboard/monthSummary";
import { getNetWorth } from "@/lib/dashboard/netWorth";
import { MonthSummaryCard } from "@/components/dashboard/MonthSummaryCard";
import { GettingStartedCard, type GettingStartedStep } from "@/components/dashboard/GettingStartedCard";

/**
 * Ana sayfa — düzen (önceki onaylı yerleşim korunarak):
 *   1. Toplam varlık (en üstte, en belirgin)
 *   2. Gelir / Gider / Net durum kartları yan yana
 *   3. Son işlemler (geniş sütun) | Yaklaşan ödemeler, Bütçe, Yatırımlar (dar sütun)
 *   4. Analiz: aylık trend + harcama dağılımı (mobilde sekmeli tek kart)
 *
 * PERFORMANS: Her bölüm kendi <Suspense> sınırında AKIŞLI yüklenir — sayfa
 * kabuğu (başlık, dönem seçici, iskeletler) tüm sorguların bitmesini
 * beklemeden hemen çizilir, veriler geldikçe kartlar yerleşir. Aynı veri
 * birden fazla bölümde gerekirse istek başına bir kez çekilir (homeData.ts).
 */
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ space?: string; period?: string; from?: string; to?: string }>;
}) {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);

  if (!user) {
    redirect("/welcome");
  }

  // Birbirinden bağımsız üç sorgu PARALEL (önceden bildirim sayısı ayrıca beklenirdi).
  const [spaces, profileHeader, unreadCount] = await Promise.all([
    getUserSpacesBasic(supabase),
    getProfileHeaderInfo(supabase, user.id),
    getUnreadNotificationCount(supabase).catch(() => 0),
  ]);

  if (spaces.length === 0) {
    redirect("/onboarding/space-type");
  }

  const params = await searchParams;
  const activeSpace = resolveActiveSpace(spaces, params.space);

  // Yetkisiz/geçersiz bir space_id → URL de güvenli alana düzeltilir (RLS zaten veriyi gizler).
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
      <div className="mx-auto w-full min-w-0 max-w-[80rem]">
        <GreetingHeader displayName={profileHeader.displayName} spaceName={activeSpace.name} spaceType={activeSpace.type} />

        <div className="mt-4 flex min-w-0 flex-col gap-4 pb-24 md:gap-5 md:pb-6">
          {activeSpace.type === "home" ? (
            <HomeDashboard
              supabase={supabase}
              bookId={activeSpace.bookId}
              spaceId={activeSpace.id}
              hasBusiness={hasBusiness}
              period={resolveHomePeriod(params.period, params.from, params.to)}
            />
          ) : (
            <BusinessDashboard supabase={supabase} bookId={activeSpace.bookId} spaceId={activeSpace.id} />
          )}
        </div>
      </div>
    </AppShell>
  );
}

/* ───────────────────────── yardımcılar ───────────────────────── */

function tryCents(list: CurrencyAmount[]) {
  return list.find((a) => a.currency === "TRY")?.cents ?? 0;
}

type Props = { supabase: SupabaseClient; bookId: string; spaceId: string };

/* ───────────────────────── Ev alanı ───────────────────────── */

function HomeDashboard({ supabase, bookId, spaceId, hasBusiness, period }: Props & { hasBusiness: boolean; period: ResolvedHomePeriod }) {
  return (
    <>
      <HomePeriodPicker active={period.period} from={period.from} to={period.to} />

      <Suspense fallback={<CardSkeleton hero lines={2} className="min-h-[11rem]" />}>
        <BalanceSection supabase={supabase} bookId={bookId} spaceId={spaceId} />
      </Suspense>

      <Suspense fallback={null}>
        <GettingStartedSection supabase={supabase} bookId={bookId} spaceId={spaceId} variant="home" />
      </Suspense>

      <Suspense
        fallback={
          <div className="grid grid-cols-2 gap-3 md:gap-5 lg:grid-cols-3">
            <CardSkeleton lines={1} />
            <CardSkeleton lines={1} />
            <CardSkeleton lines={1} className="col-span-2 lg:col-span-1" />
          </div>
        }
      >
        <FlowKpiSection supabase={supabase} bookId={bookId} spaceId={spaceId} period={period} />
      </Suspense>

      <Suspense fallback={<CardSkeleton lines={3} />}>
        <MonthSummarySection supabase={supabase} bookId={bookId} spaceId={spaceId} />
      </Suspense>

      <div className="grid min-w-0 grid-cols-1 gap-4 md:gap-5 lg:grid-cols-3 lg:items-start">
        <div className="min-w-0 lg:col-span-2">
          <Suspense fallback={<CardSkeleton lines={5} />}>
            <RecentSection supabase={supabase} bookId={bookId} spaceId={spaceId} />
          </Suspense>
        </div>

        <div className="flex min-w-0 flex-col gap-4 md:gap-5">
          <Suspense fallback={<CardSkeleton lines={2} />}>
            <UpcomingSection supabase={supabase} bookId={bookId} spaceId={spaceId} />
          </Suspense>
          <Suspense fallback={<CardSkeleton lines={3} />}>
            <BudgetSection supabase={supabase} bookId={bookId} spaceId={spaceId} />
          </Suspense>
          <Suspense fallback={<CardSkeleton lines={2} />}>
            <PortfolioSection supabase={supabase} bookId={bookId} spaceId={spaceId} />
          </Suspense>
        </div>
      </div>

      <Suspense fallback={<CardSkeleton lines={4} className="min-h-[14rem]" />}>
        <InsightsSection supabase={supabase} bookId={bookId} spaceId={spaceId} range={period.range} rangeLabel={period.label} />
      </Suspense>

      {!hasBusiness ? (
        <Link
          href="/spaces/new-business"
          className="surface-card flex min-w-0 items-center gap-3 rounded-3xl border-dashed p-4 transition-colors hover:bg-surface-muted active:scale-[0.99]"
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

      <QuickActions bookId={bookId} spaceParam={spaceId} />
    </>
  );
}

async function BalanceSection({ supabase, bookId, spaceId }: { supabase: SupabaseClient; bookId: string; spaceId: string }) {
  // "Toplam varlık" YALNIZCA TRY hesap + alacak + yatırım toplamıdır.
  // Yatırım değeri güncel fiyat VARSA güncel değer, YOKSA maliyet bazı
  // (computePortfolioTotals ile /investments sayfasıyla AYNI mantık).
  const [balance, receivables, holdings, netWorth] = await Promise.allSettled([
    getBalancesCached(supabase, bookId),
    getReceivablesSummary(supabase, bookId),
    getHoldingsCached(supabase, bookId),
    getNetWorth(supabase, bookId),
  ]);

  const balances = balance.status === "fulfilled" ? balance.value : [];
  const tryBalanceCents = tryCents(balances);
  const receivablesCents = receivables.status === "fulfilled" ? receivables.value.totalCents : 0;
  const tryTotals = computePortfolioTotals((holdings.status === "fulfilled" ? holdings.value : []).filter((h) => h.currency === "TRY"));
  const investmentsCents = tryTotals.totalCurrentValueCents ?? tryTotals.totalCostBasisCents;
  const totalAssetsCents = balance.status === "fulfilled" ? tryBalanceCents + receivablesCents + investmentsCents : null;

  return (
    <BalanceHeroCard
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
      otherCurrencyBalances={balances.filter((a) => a.currency !== "TRY")}
      hasAccounts={balance.status !== "fulfilled" || balances.length > 0}
      netWorth={
        netWorth.status === "fulfilled"
          ? { netCents: netWorth.value.netCents, payablesCents: netWorth.value.payablesCents, href: `/net-worth?space=${spaceId}` }
          : null
      }
    />
  );
}

async function FlowKpiSection({ supabase, bookId, spaceId, period }: Props & { period: ResolvedHomePeriod }) {
  const [flow, prevFlow] = await Promise.allSettled([
    getFlowForPeriod(supabase, bookId, "month", period.range),
    getFlowForPeriod(supabase, bookId, "month", period.previous),
  ]);

  if (flow.status !== "fulfilled") {
    return (
      <DashboardCard title={period.label}>
        <CardError />
      </DashboardCard>
    );
  }

  const income = tryCents(flow.value.income);
  const expense = tryCents(flow.value.expense);
  const net = income - expense;
  const prev = prevFlow.status === "fulfilled" ? { income: tryCents(prevFlow.value.income), expense: tryCents(prevFlow.value.expense) } : null;
  const otherCurrencies = Array.from(new Set([...flow.value.income, ...flow.value.expense].map((a) => a.currency))).filter((c) => c !== "TRY");
  const spentPct = income > 0 ? (expense / income) * 100 : null;

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex min-w-0 items-center justify-between gap-2 px-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">{period.label}</p>
        {income === 0 && expense === 0 ? (
          <Link href={`/add-transaction?type=expense&book_id=${bookId}&space=${spaceId}`} className="text-xs font-bold text-accent">
            İşlem ekle
          </Link>
        ) : null}
      </div>
      <div className="grid min-w-0 grid-cols-2 gap-3 md:gap-5 lg:grid-cols-3">
        <KpiCard
          label="Gelir"
          tone="income"
          icon={<ArrowUpRightIcon size={16} />}
          value={formatCentsAsCurrency(income, "TRY")}
          badge={prev ? <DeltaBadge current={income} previous={prev.income} goodWhen="up" /> : null}
          delay={40}
        />
        <KpiCard
          label="Gider"
          tone="expense"
          icon={<ArrowDownRightIcon size={16} />}
          value={formatCentsAsCurrency(expense, "TRY")}
          badge={prev ? <DeltaBadge current={expense} previous={prev.expense} goodWhen="down" /> : null}
          footnote={spentPct !== null ? `Gider / gelir: %${Math.round(spentPct)}` : null}
          delay={80}
        />
        <KpiCard
          label="Net durum"
          tone={net > 0 ? "income" : net < 0 ? "expense" : "balance"}
          icon={<span className="text-sm font-black leading-none">±</span>}
          value={`${net > 0 ? "+" : net < 0 ? "−" : ""}${formatCentsAsCurrency(Math.abs(net), "TRY")}`}
          badge={prev ? <DeltaBadge current={net} previous={prev.income - prev.expense} goodWhen="up" /> : null}
          className="col-span-2 lg:col-span-1"
          delay={120}
        />
      </div>
      {otherCurrencies.length > 0 ? (
        <p className="px-1 text-[11px] text-text-muted">
          Diğer para birimleri:{" "}
          {otherCurrencies
            .map(
              (c) =>
                `${c} +${formatCentsAsCurrency(flow.value.income.find((a) => a.currency === c)?.cents ?? 0, c)} / −${formatCentsAsCurrency(flow.value.expense.find((a) => a.currency === c)?.cents ?? 0, c)}`
            )
            .join(" · ")}
        </p>
      ) : null}
    </div>
  );
}

async function RecentSection({ supabase, bookId, spaceId }: Props) {
  const recent = await getTransactionHistory(supabase, bookId, { limit: 5 }).then(
    (v) => ({ ok: true as const, v }),
    () => ({ ok: false as const })
  );
  return (
    <DashboardCard title="Son işlemler" icon={<ListIcon size={16} />} action={<CardLink href={`/transactions?space=${spaceId}`} />}>
      {!recent.ok ? (
        <CardError />
      ) : recent.v.rows.length === 0 ? (
        <CardEmptyState
          message="Henüz işlem eklemedin."
          hint="İlk gelir veya giderini ekleyerek başlayabilirsin."
          action={{ href: `/add-transaction?type=expense&book_id=${bookId}&space=${spaceId}`, label: "İşlem ekle" }}
        />
      ) : (
        <div className="flex min-w-0 flex-col gap-2">
          {recent.v.rows.map((row) => (
            <TransactionListItem key={row.entryId} row={row} spaceParam={spaceId} bookId={bookId} />
          ))}
        </div>
      )}
    </DashboardCard>
  );
}

async function UpcomingSection({
  supabase,
  bookId,
  spaceId,
  direction,
}: Props & { direction?: "payable" | "receivable" }) {
  const debts = await getUpcomingDebts(supabase, bookId, direction ? { direction } : {}).then(
    (v) => ({ ok: true as const, v }),
    () => ({ ok: false as const })
  );
  const title = direction === "receivable" ? "Yaklaşan tahsilatlar" : "Yaklaşan ödemeler";
  return (
    <DashboardCard
      title={title}
      icon={<ClockIcon size={16} />}
      action={<CardLink href={`/debts?space=${spaceId}${direction ? `&direction=${direction}` : ""}`} />}
    >
      {debts.ok ? (
        <DebtList
          debts={debts.v}
          spaceParam={spaceId}
          emptyMessage={direction === "receivable" ? "Yaklaşan tahsilat yok." : "Yaklaşan ödeme yok."}
          emptyHint={
            direction === "receivable"
              ? "Vadesi gelen alacakların burada listelenecek."
              : "Vadesi gelen borç/alacak eklediğinde burada göreceksin."
          }
        />
      ) : (
        <CardError />
      )}
    </DashboardCard>
  );
}

async function BudgetSection({ supabase, bookId, spaceId }: Props) {
  const budgets = await getBudgets(supabase, bookId).then(
    (v) => ({ ok: true as const, v }),
    () => ({ ok: false as const })
  );
  return (
    <DashboardCard title="Bütçe" subtitle="Bu ay" icon={<PieChartIcon size={16} />} action={<CardLink href={`/budgets?space=${spaceId}`} />}>
      {!budgets.ok ? (
        <CardError />
      ) : budgets.v.length === 0 ? (
        <CardEmptyState
          message="Bu ay için bütçe yok."
          hint="Harcama sınırı belirleyerek ne kadar harcadığını takip edebilirsin."
          action={{ href: `/budgets/new?book_id=${bookId}&space=${spaceId}`, label: "Bütçe oluştur" }}
        />
      ) : (
        <div className="flex min-w-0 flex-col gap-3">
          {budgets.v.slice(0, 3).map((b) => (
            <BudgetListItem key={b.id} budget={b} spaceParam={spaceId} compact />
          ))}
          {budgets.v.length > 3 ? (
            <Link href={`/budgets?space=${spaceId}`} className="text-center text-xs font-semibold text-text-muted hover:text-accent">
              +{budgets.v.length - 3} bütçe daha
            </Link>
          ) : null}
        </div>
      )}
    </DashboardCard>
  );
}

async function PortfolioSection({ supabase, bookId, spaceId }: Props) {
  const holdings = await getHoldingsCached(supabase, bookId).then(
    (v) => ({ ok: true as const, v }),
    () => ({ ok: false as const })
  );
  if (!holdings.ok) {
    return (
      <DashboardCard title="Yatırımlar" icon={<TrendingUpIcon size={16} />}>
        <CardError />
      </DashboardCard>
    );
  }

  // Para birimine göre ayrı özet — farklı para birimleri toplanmaz.
  const currencies = Array.from(new Set(holdings.v.map((h) => h.currency)));
  return (
    <DashboardCard title="Yatırımlar" icon={<TrendingUpIcon size={16} />} action={<CardLink href={`/investments?space=${spaceId}`} />}>
      {currencies.length === 0 ? (
        <CardEmptyState
          message="Henüz yatırımın yok."
          hint="Hisse, altın, döviz veya kripto alışlarını kaydedebilirsin."
          action={{ href: `/investments/buy?book_id=${bookId}&space=${spaceId}`, label: "Alış ekle" }}
        />
      ) : (
        <ul className="flex min-w-0 flex-col gap-2">
          {currencies.map((c) => {
            const list = holdings.v.filter((h) => h.currency === c);
            const t = computePortfolioTotals(list);
            const value = t.totalCurrentValueCents ?? t.totalCostBasisCents;
            const gain = t.totalUnrealizedGainCents;
            return (
              <li key={c} className="flex min-w-0 items-center justify-between gap-3 rounded-2xl bg-surface-muted/50 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-text-primary">
                    {t.holdingCount} varlık · {c}
                  </p>
                  <p className="text-[11px] text-text-muted">{t.hasAnyPrice ? "Güncel değer" : "Maliyet bazlı"}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <p className="text-sm font-bold tabular-nums text-text-primary">{formatCentsAsCurrency(value, c)}</p>
                  {gain !== null ? (
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                        gain >= 0 ? "bg-income-soft text-income" : "bg-expense-soft text-expense"
                      }`}
                    >
                      {gain >= 0 ? "+" : "−"}
                      {formatCentsAsCurrency(Math.abs(gain), c)}
                    </span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </DashboardCard>
  );
}

async function InsightsSection({
  supabase,
  bookId,
  spaceId,
  range,
  rangeLabel,
}: Props & { range: { start: string; end: string }; rangeLabel: string }) {
  const [trend, categories] = await Promise.allSettled([
    getMonthlyTrend(supabase, bookId, 6),
    getExpenseByCategory(supabase, bookId, "month", range),
  ]);

  const trendContent =
    trend.status !== "fulfilled" ? (
      <CardError />
    ) : trend.value.every((r) => r.incomeCents === 0 && r.expenseCents === 0) ? (
      <CardEmptyState
        message="Henüz trend oluşacak kadar veri yok."
        hint="Birkaç ay boyunca işlem ekledikçe aylık değişimin burada görünecek."
        icon={<TrendingUpIcon size={20} />}
      />
    ) : (
      <TrendChart points={toTrendPoints(trend.value)} />
    );

  const rows = categories.status === "fulfilled" ? categories.value : [];
  const top = topCategoryLabel(rows);
  const donutContent =
    categories.status !== "fulfilled" ? (
      <CardError />
    ) : rows.length === 0 ? (
      <CardEmptyState message="Bu dönemde gider yok." hint="Giderlerin kategorilere göre burada dağılacak." icon={<PieChartIcon size={20} />} />
    ) : (
      <>
        {top ? <p className="mb-3 text-xs font-semibold text-text-secondary">{top}</p> : null}
        <DonutChart segments={toDonutSegments(rows)} centerLabel="Toplam gider" />
        <Link href={`/reports?space=${spaceId}`} className="mt-3 block text-center text-xs font-bold text-accent">
          Tüm raporlar →
        </Link>
      </>
    );

  return (
    <InsightsPanel
      tabs={[
        { key: "trend", label: "Aylık trend", content: trendContent },
        { key: "categories", label: `Harcama dağılımı · ${rangeLabel}`, content: donutContent },
      ]}
    />
  );
}

/* ───────────────────────── İşletme alanı ───────────────────────── */

async function BusinessSummarySection({ supabase, bookId }: { supabase: SupabaseClient; bookId: string }) {
  const summary = await getBusinessSummary(supabase, bookId).then(
    (v) => ({ ok: true as const, v }),
    () => ({ ok: false as const })
  );
  return summary.ok ? (
    <BusinessSummaryGrid bookId={bookId} initialSummary={summary.v} />
  ) : (
    <DashboardCard title="İşletme özeti">
      <CardError />
    </DashboardCard>
  );
}

function BusinessDashboard({ supabase, bookId, spaceId }: Props) {
  const month = resolveHomePeriod("month");
  return (
    <>
      <Suspense fallback={<CardSkeleton hero lines={4} className="min-h-[16rem]" />}>
        <BusinessSummarySection supabase={supabase} bookId={bookId} />
      </Suspense>

      <Suspense fallback={null}>
        <GettingStartedSection supabase={supabase} bookId={bookId} spaceId={spaceId} variant="business" />
      </Suspense>

      <div className="grid min-w-0 grid-cols-1 gap-4 md:gap-5 lg:grid-cols-3 lg:items-start">
        <div className="min-w-0 lg:col-span-2">
          <Suspense fallback={<CardSkeleton lines={5} />}>
            <RecentSection supabase={supabase} bookId={bookId} spaceId={spaceId} />
          </Suspense>
        </div>
        <div className="flex min-w-0 flex-col gap-4 md:gap-5">
          <Suspense fallback={<CardSkeleton lines={2} />}>
            <UpcomingSection supabase={supabase} bookId={bookId} spaceId={spaceId} direction="payable" />
          </Suspense>
          <Suspense fallback={<CardSkeleton lines={2} />}>
            <UpcomingSection supabase={supabase} bookId={bookId} spaceId={spaceId} direction="receivable" />
          </Suspense>
        </div>
      </div>

      <Suspense fallback={<CardSkeleton lines={4} className="min-h-[14rem]" />}>
        <InsightsSection supabase={supabase} bookId={bookId} spaceId={spaceId} range={month.range} rangeLabel={month.label} />
      </Suspense>

      <QuickActions bookId={bookId} spaceParam={spaceId} variant="business" />
    </>
  );
}

/* ───────────────────────── başlangıç ve özet ───────────────────────── */

/** İlk kurulum adımları — gerçek kayıtlara göre işaretlenir; hepsi bitince kart gösterilmez. */
async function GettingStartedSection({ supabase, bookId, spaceId, variant }: Props & { variant: "home" | "business" }) {
  const head = { count: "exact" as const, head: true };
  const [accounts, entries, budgets, goals, rules, members] = await Promise.all([
    supabase.from("accounts").select("id", head).eq("book_id", bookId),
    supabase.from("transaction_entries").select("id", head).eq("book_id", bookId),
    supabase.from("budgets").select("id", head).eq("book_id", bookId),
    supabase.from("savings_goals").select("id", head).eq("book_id", bookId),
    supabase.from("recurring_transaction_rules").select("id", head).eq("book_id", bookId),
    supabase.from("space_members").select("user_id", head).eq("space_id", spaceId),
  ]);
  // Sayım okunamadıysa (ör. ağ hatası) kart gösterilmez — yanlış "yapılmadı" gösterme.
  if ([accounts, entries, budgets, goals, rules, members].some((r) => r.error)) return null;
  const q = `space=${spaceId}`;
  const has = (r: { count: number | null }) => (r.count ?? 0) > 0;

  const steps: GettingStartedStep[] =
    variant === "home"
      ? [
          { key: "account", label: "Hesabını ekle", hint: "Banka, nakit veya kredi kartı", href: `/accounts/new?book_id=${bookId}&${q}`, done: has(accounts) },
          { key: "tx", label: "İlk gelir veya giderini kaydet", hint: "Bugünkü bir harcamayla başla", href: `/add-transaction?type=expense&book_id=${bookId}&${q}`, done: has(entries) },
          { key: "recurring", label: "Maaşını veya aboneliklerini otomatiğe bağla", hint: "Her ay elle girmekten kurtul", href: `/transactions/recurring/new?book_id=${bookId}&${q}`, done: has(rules) },
          { key: "budget", label: "Bu ay için bütçe belirle", hint: "Harcama sınırını aşınca uyaralım", href: `/budgets/new?book_id=${bookId}&${q}`, done: has(budgets) },
          { key: "goal", label: "Bir birikim hedefi koy", hint: "Tatil, acil durum fonu…", href: `/goals/new?book_id=${bookId}&${q}`, done: has(goals) },
        ]
      : [
          { key: "account", label: "Kasa veya banka hesabını ekle", hint: "İşletmenin para tuttuğu hesaplar", href: `/accounts/new?book_id=${bookId}&${q}`, done: has(accounts) },
          { key: "tx", label: "İlk satış veya giderini kaydet", hint: "Bugünkü bir işlemle başla", href: `/add-transaction?type=income&book_id=${bookId}&${q}`, done: has(entries) },
          { key: "recurring", label: "Kira, maaş gibi düzenli giderleri otomatiğe bağla", hint: "Her ay elle girmekten kurtul", href: `/transactions/recurring/new?book_id=${bookId}&${q}`, done: has(rules) },
          { key: "members", label: "Ekip arkadaşını davet et", hint: "Muhasebecin veya ortağın", href: `/settings/spaces/${spaceId}/members`, done: (members.count ?? 0) > 1 },
        ];

  return <GettingStartedCard spaceId={spaceId} steps={steps} />;
}

/** İstek anı (render dışında). */
function requestNow() {
  return new Date();
}

const monthNameFmt = new Intl.DateTimeFormat("tr-TR", { month: "long", timeZone: "Europe/Istanbul" });

async function MonthSummarySection({ supabase, bookId, spaceId }: Props) {
  const now = requestNow();
  const summary = await getMonthSummary(supabase, bookId, now).catch(() => null);
  if (!summary) return null;
  const label = monthNameFmt.format(now);
  return <MonthSummaryCard summary={summary} monthLabel={label.charAt(0).toLocaleUpperCase("tr-TR") + label.slice(1)} spaceId={spaceId} />;
}
