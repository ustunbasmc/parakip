import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfileHeaderInfo } from "@/lib/avatars";
import { AppShell } from "@/components/AppShell";
import { SpaceSwitcher } from "@/components/dashboard/SpaceSwitcher";
import { ProfileMenu } from "@/components/dashboard/ProfileMenu";
import { NotificationBell } from "@/components/dashboard/NotificationBell";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import { DashboardCard, CardError, CardEmptyState, CardLink } from "@/components/dashboard/DashboardCard";
import { PeriodSelector } from "@/components/dashboard/PeriodSelector";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { DonutChart } from "@/components/charts/DonutChart";
import { TrendChart } from "@/components/charts/TrendChart";
import { DeltaBadge } from "@/components/ui/DeltaBadge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import {
  ArrowDownRightIcon,
  ArrowUpRightIcon,
  ClockIcon,
  PieChartIcon,
  TagIcon,
  TransferIcon,
  TrendingUpIcon,
  WalletIcon,
} from "@/components/icons";
import { toDonutSegments, toTrendPoints, topCategoryLabel } from "@/lib/format/chartData";
import { categoryColor } from "@/lib/format/categoryColor";
import { formatCentsAsCurrency, formatShare } from "@/lib/format/amount";
import { formatDueDateLabel, getPreviousPeriodRange, PERIOD_LABELS, type DashboardPeriod } from "@/lib/format/date";
import { getUserSpacesBasic, resolveActiveSpace } from "@/lib/dashboard/formData";
import { getUnreadNotificationCount } from "@/lib/dashboard/notifications";
import { getFlowForPeriod, type CurrencyAmount } from "@/lib/dashboard/queries";
import {
  getExpenseByCategory,
  getExpenseByCategoryForKind,
  getReportKindSummary,
  getMonthlyTrend,
  getAccountBalanceComparison,
  getCollectedVsPending,
  getRecurringImpactNext30Days,
  type CategoryBreakdownRow,
  type ReportKind,
} from "@/lib/dashboard/reports";

const VALID_PERIODS = new Set(["today", "week", "month", "year"]);
const VALID_KINDS = new Set(["all", "sale", "purchase", "expense", "collection", "payment"]);
const REPORT_KIND_TABS: { value: ReportKind; label: string }[] = [
  { value: "all", label: "Tümü" },
  { value: "sale", label: "Satış" },
  { value: "purchase", label: "Alış" },
  { value: "expense", label: "Masraf" },
  { value: "collection", label: "Tahsilat" },
  { value: "payment", label: "Ödeme" },
];
const PREVIOUS_LABEL: Record<DashboardPeriod, string> = {
  today: "düne",
  week: "geçen haftaya",
  month: "geçen aya",
  year: "geçen yıla",
};

function tryCents(list: CurrencyAmount[]) {
  return list.find((a) => a.currency === "TRY")?.cents ?? 0;
}

function settled<T>(r: PromiseSettledResult<T>): T | null {
  return r.status === "fulfilled" ? r.value : null;
}

/**
 * Raporlar ekranı. Sıralama "en önemli bilgi üstte" ilkesine göre:
 *   1. Dönem özeti (gelir / gider / net) + önceki eşdeğer döneme göre değişim
 *   2. Kategori dağılımı + aylık trend
 *   3. Kategori karşılaştırması (bu dönem vs önceki dönem)
 *   4. Hesap bakiyeleri, tahsilat/ödeme durumu, planlı ödemeler
 * Tüm tutarlar mevcut rapor sorgularından gelir; önceki dönem için AYNI
 * sorgular önceki aralıkla çalıştırılır (yeni hesaplama mantığı yoktur).
 */
export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ space?: string; period?: string; kind?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));

  if (!user) redirect("/welcome");

  const [profileHeader, spaces, unreadCount] = await Promise.all([
    getProfileHeaderInfo(supabase, user.id),
    getUserSpacesBasic(supabase),
    getUnreadNotificationCount(supabase).catch(() => 0),
  ]);
  if (spaces.length === 0) redirect("/onboarding/space-type");

  const params = await searchParams;
  const activeSpace = resolveActiveSpace(spaces, params.space);
  if (params.space && params.space !== activeSpace.id) {
    redirect(`/reports?space=${activeSpace.id}`);
  }

  const period = (VALID_PERIODS.has(params.period ?? "") ? params.period : "month") as DashboardPeriod;
  const isBusiness = activeSpace.type === "business";
  const kind = (isBusiness && VALID_KINDS.has(params.kind ?? "") ? params.kind : "all") as ReportKind;
  const prevRange = getPreviousPeriodRange(period);
  const bookId = activeSpace.bookId;
  const categoryKind = kind === "purchase" || kind === "expense" ? kind : null;
  const showsCategories = kind === "all" || categoryKind !== null;

  const [flow, prevFlow, categories, prevCategories, trend, accounts, collectedVsPending, recurringImpact, kindSummary, prevKindSummary] =
    await Promise.allSettled([
      kind === "all" ? getFlowForPeriod(supabase, bookId, period) : Promise.resolve(null),
      kind === "all" ? getFlowForPeriod(supabase, bookId, period, prevRange) : Promise.resolve(null),
      categoryKind
        ? getExpenseByCategoryForKind(supabase, bookId, period, categoryKind)
        : kind === "all"
          ? getExpenseByCategory(supabase, bookId, period)
          : Promise.resolve([] as CategoryBreakdownRow[]),
      categoryKind
        ? getExpenseByCategoryForKind(supabase, bookId, period, categoryKind, prevRange)
        : kind === "all"
          ? getExpenseByCategory(supabase, bookId, period, prevRange)
          : Promise.resolve([] as CategoryBreakdownRow[]),
      getMonthlyTrend(supabase, bookId, 6),
      getAccountBalanceComparison(supabase, bookId),
      getCollectedVsPending(supabase, bookId),
      getRecurringImpactNext30Days(supabase, bookId),
      kind === "all" ? Promise.resolve(null) : getReportKindSummary(supabase, bookId, period, kind),
      kind === "all" ? Promise.resolve(null) : getReportKindSummary(supabase, bookId, period, kind, prevRange),
    ]);

  const categoryRows = settled(categories) ?? [];
  const prevCategoryRows = settled(prevCategories) ?? [];
  const periodQuery = `space=${activeSpace.id}&period=${period}`;

  return (
    <AppShell
      helpSlug="raporlar-ne-gosterir"
      activeSpaceType={activeSpace.type}
      title="Raporlar"
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
      <div className="mx-auto flex w-full min-w-0 max-w-[80rem] flex-col gap-4 pb-6 pt-2 md:gap-5 md:pt-4">
        {/* Dönem + dışa aktarma */}
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <PeriodSelector active={period} />
          </div>
          <div className="shrink-0 self-end sm:self-auto">
            <ExportCsvButton
              headers={["Kategori", "Toplam"]}
              rows={categoryRows.map((c) => [c.categoryName, (c.totalCents / 100).toFixed(2).replace(".", ",")])}
              filename={`rapor-${activeSpace.id}-${period}.csv`}
              label="Raporu indir"
            />
          </div>
        </div>

        {isBusiness ? (
          <nav
            aria-label="Rapor türü"
            className="flex min-w-0 gap-1 overflow-x-auto rounded-2xl border border-border bg-surface p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {REPORT_KIND_TABS.map((tab) => (
              <Link
                key={tab.value}
                href={`/reports?${periodQuery}${tab.value === "all" ? "" : `&kind=${tab.value}`}`}
                aria-current={kind === tab.value ? "page" : undefined}
                className={`shrink-0 whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors ${
                  kind === tab.value ? "bg-accent text-text-on-accent" : "text-text-secondary hover:bg-surface-muted"
                }`}
              >
                {tab.label}
              </Link>
            ))}
          </nav>
        ) : null}

        {/* 1. Dönem özeti */}
        {kind === "all" ? (
          <FlowSummary flow={settled(flow)} prevFlow={settled(prevFlow)} period={period} />
        ) : (
          <KindSummary
            label={REPORT_KIND_TABS.find((t) => t.value === kind)?.label ?? "Özet"}
            summary={settled(kindSummary)}
            prev={settled(prevKindSummary)}
            period={period}
            tone={kind === "sale" || kind === "collection" ? "income" : "expense"}
          />
        )}

        {/* 2. Dağılım + trend */}
        <div className="grid min-w-0 grid-cols-1 gap-4 md:gap-5 lg:grid-cols-3 lg:items-start">
          {showsCategories ? (
            <DashboardCard
              title="Kategori dağılımı"
              subtitle={categories.status === "fulfilled" ? topCategoryLabel(categoryRows) ?? PERIOD_LABELS[period] : undefined}
              icon={<PieChartIcon size={16} />}
            >
              {categories.status !== "fulfilled" ? (
                <CardError />
              ) : categoryRows.length === 0 ? (
                <CardEmptyState
                  message="Bu aralıkta gider kaydı yok."
                  hint="Seçili dönemde gider eklendiğinde kategorilere göre dağılım burada görünecek."
                  icon={<PieChartIcon size={20} />}
                />
              ) : (
                <DonutChart segments={toDonutSegments(categoryRows)} centerLabel="Toplam gider" />
              )}
            </DashboardCard>
          ) : null}

          <DashboardCard
            title="Aylık karşılaştırma"
            subtitle="Son 6 ay · gelir ve gider"
            icon={<TrendingUpIcon size={16} />}
            className={showsCategories ? "lg:col-span-2" : "lg:col-span-3"}
          >
            {trend.status !== "fulfilled" ? (
              <CardError />
            ) : trend.value.every((r) => r.incomeCents === 0 && r.expenseCents === 0) ? (
              <CardEmptyState
                message="Henüz yeterli işlem geçmişi yok."
                hint="Birkaç ay boyunca işlem ekledikçe aylık karşılaştırma burada görünecek."
                icon={<TrendingUpIcon size={20} />}
              />
            ) : (
              <TrendChart points={toTrendPoints(trend.value)} />
            )}
          </DashboardCard>
        </div>

        {/* 3. Kategori karşılaştırması */}
        {showsCategories && categories.status === "fulfilled" && categoryRows.length > 0 ? (
          <CategoryComparison rows={categoryRows} prevRows={prevCategoryRows} prevLabel={PREVIOUS_LABEL[period]} />
        ) : null}

        {/* 4. Hesaplar, tahsilat/ödeme, planlı ödemeler */}
        <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 md:gap-5 lg:grid-cols-3 lg:items-start">
          <DashboardCard
            title="Hesap bakiyeleri"
            icon={<WalletIcon size={16} />}
            action={<CardLink href={`/accounts?space=${activeSpace.id}`}>Hesaplar</CardLink>}
          >
            {accounts.status !== "fulfilled" ? (
              <CardError />
            ) : accounts.value.length === 0 ? (
              <CardEmptyState
                message="Henüz hesap eklenmedi."
                action={{ href: `/accounts/new?space=${activeSpace.id}`, label: "Hesap ekle" }}
              />
            ) : (
              <AccountBars accounts={accounts.value} />
            )}
          </DashboardCard>

          <DashboardCard
            title="Tahsilat ve ödeme durumu"
            icon={<TransferIcon size={16} />}
            action={<CardLink href={`/debts?space=${activeSpace.id}`}>Borçlar</CardLink>}
          >
            {collectedVsPending.status !== "fulfilled" ? <CardError /> : <CollectionStatus data={collectedVsPending.value} />}
          </DashboardCard>

          <DashboardCard
            title="Önümüzdeki 30 gün"
            subtitle="Tekrarlayan ödemeler"
            icon={<ClockIcon size={16} />}
            className="md:col-span-2 lg:col-span-1"
            action={<CardLink href={`/debts/recurring?space=${activeSpace.id}`}>Kurallar</CardLink>}
          >
            {recurringImpact.status !== "fulfilled" ? (
              <CardError />
            ) : recurringImpact.value.length === 0 ? (
              <CardEmptyState
                message="Önümüzdeki 30 günde planlı ödeme yok."
                hint="Kira, kredi taksidi gibi düzenli ödemeler için tekrarlayan kural ekleyebilirsin."
                action={{ href: `/debts/recurring/new?space=${activeSpace.id}`, label: "Kural ekle" }}
                icon={<ClockIcon size={20} />}
              />
            ) : (
              <RecurringList rows={recurringImpact.value} />
            )}
          </DashboardCard>
        </div>

        <p className="px-1 text-center text-xs text-text-muted">
          &ldquo;Raporu indir&rdquo; kategori özetini CSV olarak verir. PDF dışa aktarma yakında.
        </p>
      </div>
    </AppShell>
  );
}

/* ───────────────────────── bölümler ───────────────────────── */

function FlowSummary({
  flow,
  prevFlow,
  period,
}: {
  flow: { income: CurrencyAmount[]; expense: CurrencyAmount[] } | null;
  prevFlow: { income: CurrencyAmount[]; expense: CurrencyAmount[] } | null;
  period: DashboardPeriod;
}) {
  if (!flow) {
    return (
      <DashboardCard title={PERIOD_LABELS[period]}>
        <CardError />
      </DashboardCard>
    );
  }
  const income = tryCents(flow.income);
  const expense = tryCents(flow.expense);
  const net = income - expense;
  const prev = prevFlow ? { income: tryCents(prevFlow.income), expense: tryCents(prevFlow.expense) } : null;
  // Tasarruf oranı yalnızca gelir varsa anlamlıdır; yoksa gösterilmez.
  const savingsPct = income > 0 ? Math.round((net / income) * 100) : null;
  const others = Array.from(new Set([...flow.income, ...flow.expense].map((a) => a.currency))).filter((c) => c !== "TRY");

  return (
    <section aria-label={`${PERIOD_LABELS[period]} özeti`} className="flex min-w-0 flex-col gap-2">
      <p className="px-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
        {PERIOD_LABELS[period]} · {PREVIOUS_LABEL[period]} göre
      </p>
      <div className="grid min-w-0 grid-cols-2 gap-3 md:gap-5 lg:grid-cols-3">
        <KpiCard
          label="Gelir"
          tone="income"
          icon={<ArrowUpRightIcon size={16} />}
          value={formatCentsAsCurrency(income, "TRY")}
          badge={prev ? <DeltaBadge current={income} previous={prev.income} goodWhen="up" /> : null}
        />
        <KpiCard
          label="Gider"
          tone="expense"
          icon={<ArrowDownRightIcon size={16} />}
          value={formatCentsAsCurrency(expense, "TRY")}
          badge={prev ? <DeltaBadge current={expense} previous={prev.expense} goodWhen="down" /> : null}
          delay={40}
        />
        <KpiCard
          label="Net durum"
          tone={net > 0 ? "income" : net < 0 ? "expense" : "balance"}
          icon={<span className="text-sm font-black leading-none">±</span>}
          value={`${net > 0 ? "+" : net < 0 ? "−" : ""}${formatCentsAsCurrency(Math.abs(net), "TRY")}`}
          badge={prev ? <DeltaBadge current={net} previous={prev.income - prev.expense} goodWhen="up" /> : null}
          footnote={savingsPct !== null ? `Tasarruf oranı: %${savingsPct}` : null}
          className="col-span-2 lg:col-span-1"
          delay={80}
        />
      </div>
      {others.length > 0 ? (
        <p className="px-1 text-[11px] text-text-muted">
          Diğer para birimleri (toplama dahil değil):{" "}
          {others
            .map(
              (c) =>
                `${c} +${formatCentsAsCurrency(flow.income.find((a) => a.currency === c)?.cents ?? 0, c)} / −${formatCentsAsCurrency(flow.expense.find((a) => a.currency === c)?.cents ?? 0, c)}`
            )
            .join(" · ")}
        </p>
      ) : null}
    </section>
  );
}

function KindSummary({
  label,
  summary,
  prev,
  period,
  tone,
}: {
  label: string;
  summary: { totalCents: number; count: number } | null;
  prev: { totalCents: number; count: number } | null;
  period: DashboardPeriod;
  tone: "income" | "expense";
}) {
  if (!summary) {
    return (
      <DashboardCard title={label}>
        <CardError />
      </DashboardCard>
    );
  }
  const avg = summary.count > 0 ? Math.round(summary.totalCents / summary.count) : null;
  return (
    <section aria-label={`${label} özeti`} className="flex min-w-0 flex-col gap-2">
      <p className="px-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
        {PERIOD_LABELS[period]} · {PREVIOUS_LABEL[period]} göre
      </p>
      <div className="grid min-w-0 grid-cols-2 gap-3 md:gap-5 lg:grid-cols-3">
        <KpiCard
          label={`Toplam ${label.toLocaleLowerCase("tr-TR")}`}
          tone={tone}
          icon={tone === "income" ? <ArrowUpRightIcon size={16} /> : <ArrowDownRightIcon size={16} />}
          value={formatCentsAsCurrency(summary.totalCents, "TRY")}
          badge={prev ? <DeltaBadge current={summary.totalCents} previous={prev.totalCents} goodWhen={tone === "income" ? "up" : "down"} /> : null}
          className="col-span-2 lg:col-span-1"
        />
        <KpiCard
          label="Kayıt sayısı"
          tone="balance"
          icon={<TagIcon size={16} />}
          value={String(summary.count)}
          footnote={prev ? `Önceki dönem: ${prev.count}` : null}
          delay={40}
        />
        <KpiCard
          label="Ortalama tutar"
          tone="balance"
          icon={<WalletIcon size={16} />}
          value={avg !== null ? formatCentsAsCurrency(avg, "TRY") : "—"}
          delay={80}
        />
      </div>
    </section>
  );
}

/** En büyük 5 kategori: bu dönem tutarı, toplam içindeki payı ve önceki döneme göre değişim. */
function CategoryComparison({
  rows,
  prevRows,
  prevLabel,
}: {
  rows: CategoryBreakdownRow[];
  prevRows: CategoryBreakdownRow[];
  prevLabel: string;
}) {
  const total = rows.reduce((s, r) => s + r.totalCents, 0);
  const prevMap = new Map(prevRows.map((r) => [r.categoryId ?? "__none__", r.totalCents]));
  const top = rows.slice(0, 5);

  return (
    <DashboardCard title="Kategori karşılaştırması" subtitle={`En çok harcanan 5 kategori · ${prevLabel} göre`} icon={<TagIcon size={16} />}>
      <ul className="grid min-w-0 grid-cols-1 gap-x-6 gap-y-3.5 md:grid-cols-2">
        {top.map((r) => {
          const prev = prevMap.get(r.categoryId ?? "__none__") ?? 0;
          const share = total > 0 ? (r.totalCents / total) * 100 : 0;
          return (
            <li key={r.categoryId ?? "none"} className="flex min-w-0 flex-col gap-1.5">
              <div className="flex min-w-0 items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: categoryColor(r.categoryId) }} aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-text-primary">{r.categoryName}</span>
                {prev > 0 ? (
                  <DeltaBadge current={r.totalCents} previous={prev} goodWhen="down" />
                ) : (
                  <span className="shrink-0 rounded-full bg-surface-muted px-1.5 py-0.5 text-[10px] font-bold text-text-muted">Yeni</span>
                )}
                <span className="shrink-0 text-sm font-bold tabular-nums text-text-primary">{formatCentsAsCurrency(r.totalCents, "TRY")}</span>
              </div>
              <ProgressBar percent={share} size="sm" tone="expense" label={`${r.categoryName} payı`} />
              <p className="flex justify-between gap-2 text-[11px] tabular-nums text-text-muted">
                <span>Pay: {formatShare(r.totalCents, total)}</span>
                <span>Önceki: {formatCentsAsCurrency(prev, "TRY")}</span>
              </p>
            </li>
          );
        })}
      </ul>
    </DashboardCard>
  );
}

function AccountBars({ accounts }: { accounts: { id: string; name: string; currency: string; balanceCents: number }[] }) {
  // Çubuk yalnızca görsel oran: aynı para birimindeki en büyük mutlak bakiyeye göre.
  const maxByCurrency = new Map<string, number>();
  for (const a of accounts) maxByCurrency.set(a.currency, Math.max(maxByCurrency.get(a.currency) ?? 0, Math.abs(a.balanceCents)));
  return (
    <div className="flex min-w-0 flex-col gap-3">
      {accounts.map((a) => {
        const max = maxByCurrency.get(a.currency) ?? 0;
        return (
          <div key={a.id} className="flex min-w-0 flex-col gap-1.5">
            <div className="flex min-w-0 items-center justify-between gap-2 text-sm">
              <span className="min-w-0 truncate font-medium text-text-secondary">{a.name}</span>
              <span className={`shrink-0 font-bold tabular-nums ${a.balanceCents < 0 ? "text-expense" : "text-text-primary"}`}>
                {formatCentsAsCurrency(a.balanceCents, a.currency)}
              </span>
            </div>
            <ProgressBar
              size="sm"
              tone={a.balanceCents < 0 ? "expense" : "balance"}
              percent={max > 0 ? (Math.abs(a.balanceCents) / max) * 100 : 0}
              label={`${a.name} bakiye oranı`}
            />
          </div>
        );
      })}
    </div>
  );
}

function CollectionStatus({
  data,
}: {
  data: { collectedCents: number; pendingReceivableCents: number; paidCents: number; pendingPayableCents: number };
}) {
  const rows = [
    {
      key: "receivable",
      title: "Alacaklar",
      done: data.collectedCents,
      pending: data.pendingReceivableCents,
      doneLabel: "Tahsil edilen",
      pendingLabel: "Bekleyen",
      tone: "income" as const,
      text: "text-income",
    },
    {
      key: "payable",
      title: "Borçlar",
      done: data.paidCents,
      pending: data.pendingPayableCents,
      doneLabel: "Ödenen",
      pendingLabel: "Bekleyen",
      tone: "expense" as const,
      text: "text-expense",
    },
  ];
  if (rows.every((r) => r.done + r.pending === 0)) {
    return <CardEmptyState message="Henüz borç veya alacak kaydı yok." hint="Kayıt ekledikçe tahsil ve ödeme oranların burada görünecek." />;
  }
  return (
    <div className="flex min-w-0 flex-col gap-4">
      {rows.map((r) => {
        const total = r.done + r.pending;
        const pct = total > 0 ? (r.done / total) * 100 : 0;
        return (
          <div key={r.key} className="flex min-w-0 flex-col gap-1.5">
            <div className="flex min-w-0 items-baseline justify-between gap-2">
              <span className="text-sm font-semibold text-text-primary">{r.title}</span>
              <span className={`text-xs font-bold tabular-nums ${r.text}`}>{total > 0 ? `%${Math.round(pct)} kapandı` : "Kayıt yok"}</span>
            </div>
            <ProgressBar percent={pct} tone={r.tone} label={`${r.title} kapanma oranı`} />
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="min-w-0 rounded-xl bg-[var(--tile-bg)] px-2.5 py-2">
                <p className="text-text-muted">{r.doneLabel}</p>
                <p className={`truncate font-bold tabular-nums ${r.text}`}>{formatCentsAsCurrency(r.done, "TRY")}</p>
              </div>
              <div className="min-w-0 rounded-xl bg-[var(--tile-bg)] px-2.5 py-2">
                <p className="text-text-muted">{r.pendingLabel}</p>
                <p className="truncate font-bold tabular-nums text-text-primary">{formatCentsAsCurrency(r.pending, "TRY")}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RecurringList({
  rows,
}: {
  rows: { id: string; counterpartyName: string; direction: "payable" | "receivable"; amountCents: number; nextDueDate: string }[];
}) {
  const incoming = rows.filter((r) => r.direction === "receivable").reduce((s, r) => s + r.amountCents, 0);
  const outgoing = rows.filter((r) => r.direction === "payable").reduce((s, r) => s + r.amountCents, 0);
  const net = incoming - outgoing;
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex min-w-0 items-center justify-between gap-2 rounded-2xl bg-[var(--tile-bg)] px-3 py-2.5">
        <span className="text-xs font-semibold text-text-secondary">Net etki</span>
        <span className={`whitespace-nowrap text-base font-extrabold tabular-nums ${net >= 0 ? "text-income" : "text-expense"}`}>
          {net > 0 ? "+" : net < 0 ? "−" : ""}
          {formatCentsAsCurrency(Math.abs(net), "TRY")}
        </span>
      </div>
      <ul className="flex min-w-0 flex-col gap-2">
        {rows.map((r) => (
          <li key={r.id} className="flex min-w-0 items-center gap-2.5">
            <span
              aria-hidden="true"
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-sm font-black ${
                r.direction === "payable" ? "bg-expense-soft text-expense" : "bg-income-soft text-income"
              }`}
            >
              {r.direction === "payable" ? "−" : "+"}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-text-primary">{r.counterpartyName}</p>
              <p className="text-[11px] text-text-muted">{formatDueDateLabel(r.nextDueDate)}</p>
            </div>
            <span className={`shrink-0 text-sm font-bold tabular-nums ${r.direction === "payable" ? "text-expense" : "text-income"}`}>
              {formatCentsAsCurrency(r.amountCents, "TRY")}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
