import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfileHeaderInfo } from "@/lib/avatars";
import { AppShell } from "@/components/AppShell";
import { SpaceSwitcher } from "@/components/dashboard/SpaceSwitcher";
import { ProfileMenu } from "@/components/dashboard/ProfileMenu";
import { NotificationBell } from "@/components/dashboard/NotificationBell";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import { DashboardCard, CardError, CardEmptyState } from "@/components/dashboard/DashboardCard";
import { PeriodSelector } from "@/components/dashboard/PeriodSelector";
import { MonthSummaryRow } from "@/components/dashboard/MonthSummaryRow";
import { CategoryBreakdownChart } from "@/components/reports/CategoryBreakdownChart";
import { MonthlyTrendChart } from "@/components/reports/MonthlyTrendChart";
import { formatCentsAsCurrency } from "@/lib/format/amount";
import { formatDueDateLabel } from "@/lib/format/date";
import { getUserSpacesBasic, resolveActiveSpace } from "@/lib/dashboard/formData";
import { getUnreadNotificationCount } from "@/lib/dashboard/notifications";
import { getFlowForPeriod } from "@/lib/dashboard/queries";
import type { DashboardPeriod } from "@/lib/format/date";
import {
  getExpenseByCategory,
  getExpenseByCategoryForKind,
  getReportKindSummary,
  getMonthlyTrend,
  getAccountBalanceComparison,
  getCollectedVsPending,
  getRecurringImpactNext30Days,
  type ReportKind,
} from "@/lib/dashboard/reports";

const VALID_PERIODS = new Set(["today", "week", "month", "year"]);
const REPORT_KIND_TABS: { value: ReportKind; label: string }[] = [
  { value: "all", label: "Tümü" },
  { value: "sale", label: "Satış" },
  { value: "purchase", label: "Alış" },
  { value: "expense", label: "Masraf" },
  { value: "collection", label: "Tahsilat" },
  { value: "payment", label: "Ödeme" },
];

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

  const [profileHeader, spaces] = await Promise.all([
    getProfileHeaderInfo(supabase, user.id),
    getUserSpacesBasic(supabase),
  ]);
  if (spaces.length === 0) redirect("/onboarding/space-type");

  const params = await searchParams;
  const activeSpace = resolveActiveSpace(spaces, params.space);
  if (params.space && params.space !== activeSpace.id) {
    redirect(`/reports?space=${activeSpace.id}`);
  }

  const period = (VALID_PERIODS.has(params.period ?? "") ? params.period : "month") as DashboardPeriod;
  const VALID_KINDS = new Set(["all", "sale", "purchase", "expense", "collection", "payment"]);
  const isBusiness = activeSpace.type === "business";
  const kind = (isBusiness && VALID_KINDS.has(params.kind ?? "") ? params.kind : "all") as ReportKind;

  let unreadCount = 0;
  try {
    unreadCount = await getUnreadNotificationCount(supabase);
  } catch {
    unreadCount = 0;
  }

  const [flow, categories, trend, accounts, collectedVsPending, recurringImpact, kindSummary] = await Promise.allSettled([
    kind === "all" ? getFlowForPeriod(supabase, activeSpace.bookId, period) : Promise.resolve(null),
    kind === "purchase" || kind === "expense"
      ? getExpenseByCategoryForKind(supabase, activeSpace.bookId, period, kind)
      : kind === "all"
        ? getExpenseByCategory(supabase, activeSpace.bookId, period)
        : Promise.resolve([]),
    getMonthlyTrend(supabase, activeSpace.bookId, 6),
    getAccountBalanceComparison(supabase, activeSpace.bookId),
    getCollectedVsPending(supabase, activeSpace.bookId),
    getRecurringImpactNext30Days(supabase, activeSpace.bookId),
    kind === "all" ? Promise.resolve(null) : getReportKindSummary(supabase, activeSpace.bookId, period, kind),
  ]);

  return (
    <AppShell
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
      <div className="flex flex-col gap-4 pt-2 pb-6 md:grid md:grid-cols-2 md:gap-5 md:pt-4 lg:grid-cols-3">
        <div className="md:col-span-2 lg:col-span-3 flex items-center justify-between gap-2">
          <div className="flex-1">
            <PeriodSelector active={period} />
          </div>
          <ExportCsvButton
            headers={["Kategori", "Toplam"]}
            rows={categories.status === "fulfilled" ? categories.value.map((c) => [c.categoryName, (c.totalCents / 100).toFixed(2).replace(".", ",")]) : []}
            filename={`rapor-${activeSpace.id}-${period}.csv`}
            label="Raporu indir"
          />
        </div>

        {isBusiness ? (
          <div className="flex gap-1 overflow-x-auto rounded-full bg-surface-muted p-1 md:col-span-2 lg:col-span-3">
            {REPORT_KIND_TABS.map((tab) => (
              <Link
                key={tab.value}
                href={`/reports?space=${activeSpace.id}&period=${period}${tab.value === "all" ? "" : `&kind=${tab.value}`}`}
                className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-semibold ${
                  kind === tab.value ? "bg-accent text-text-on-accent" : "text-text-secondary"
                }`}
              >
                {tab.label}
              </Link>
            ))}
          </div>
        ) : null}

        <div className="md:col-span-2 lg:col-span-3">
          {kind === "all" ? (
            flow.status === "fulfilled" && flow.value ? (
              <MonthSummaryRow income={flow.value.income} expense={flow.value.expense} period={period} />
            ) : (
              <DashboardCard title="Özet">
                <CardError />
              </DashboardCard>
            )
          ) : kindSummary.status === "fulfilled" && kindSummary.value ? (
            <DashboardCard title={REPORT_KIND_TABS.find((t) => t.value === kind)?.label ?? "Özet"}>
              <p className="text-2xl font-extrabold tabular-nums text-text-primary">
                {formatCentsAsCurrency(kindSummary.value.totalCents, "TRY")}
              </p>
              <p className="text-xs text-text-muted">{kindSummary.value.count} kayıt</p>
            </DashboardCard>
          ) : (
            <DashboardCard title="Özet">
              <CardError />
            </DashboardCard>
          )}
        </div>

        <DashboardCard title="Kategori bazlı gider dağılımı">
          {categories.status === "fulfilled" ? (
            categories.value.length === 0 ? (
              <CardEmptyState message="Bu aralıkta gider kaydı yok." />
            ) : (
              <CategoryBreakdownChart rows={categories.value} />
            )
          ) : (
            <CardError />
          )}
        </DashboardCard>

        <DashboardCard title="Aylık karşılaştırma (son 6 ay)">
          {trend.status === "fulfilled" ? (
            trend.value.every((r) => r.incomeCents === 0 && r.expenseCents === 0) ? (
              <CardEmptyState message="Henüz yeterli işlem geçmişi yok." />
            ) : (
              <>
                <MonthlyTrendChart rows={trend.value} />
                <div className="mt-3 flex items-center gap-4 text-xs text-text-muted">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-success" /> Gelir
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-danger" /> Gider
                  </span>
                </div>
              </>
            )
          ) : (
            <CardError />
          )}
        </DashboardCard>

        <DashboardCard title="Hesap bazlı bakiye karşılaştırması">
          {accounts.status === "fulfilled" ? (
            accounts.value.length === 0 ? (
              <CardEmptyState message="Henüz hesap eklenmedi." />
            ) : (
              <div className="flex flex-col gap-2">
                {accounts.value.map((a) => (
                  <div key={a.id} className="flex min-w-0 items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate text-text-secondary">{a.name}</span>
                    <span className={`shrink-0 font-semibold tabular-nums ${a.balanceCents < 0 ? "text-danger" : "text-text-primary"}`}>
                      {formatCentsAsCurrency(a.balanceCents, a.currency)}
                    </span>
                  </div>
                ))}
              </div>
            )
          ) : (
            <CardError />
          )}
        </DashboardCard>

        <DashboardCard title="Tahsil edilen ve bekleyen">
          {collectedVsPending.status === "fulfilled" ? (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-text-muted">Tahsil edilen</p>
                <p className="font-bold tabular-nums text-success">
                  {formatCentsAsCurrency(collectedVsPending.value.collectedCents, "TRY")}
                </p>
              </div>
              <div>
                <p className="text-xs text-text-muted">Bekleyen tahsilat</p>
                <p className="font-bold tabular-nums text-success">
                  {formatCentsAsCurrency(collectedVsPending.value.pendingReceivableCents, "TRY")}
                </p>
              </div>
              <div>
                <p className="text-xs text-text-muted">Ödenen</p>
                <p className="font-bold tabular-nums text-danger">
                  {formatCentsAsCurrency(collectedVsPending.value.paidCents, "TRY")}
                </p>
              </div>
              <div>
                <p className="text-xs text-text-muted">Bekleyen ödeme</p>
                <p className="font-bold tabular-nums text-danger">
                  {formatCentsAsCurrency(collectedVsPending.value.pendingPayableCents, "TRY")}
                </p>
              </div>
            </div>
          ) : (
            <CardError />
          )}
        </DashboardCard>

        <DashboardCard title="Planlı ödemelerin 30 günlük etkisi">
          {recurringImpact.status === "fulfilled" ? (
            recurringImpact.value.length === 0 ? (
              <CardEmptyState
                message="Önümüzdeki 30 günde vadesi gelecek tekrarlayan ödeme yok."
                hint="Borçlar bölümünden tekrarlayan ödeme kuralı ekleyebilirsin."
              />
            ) : (
              <div className="flex flex-col gap-2">
                {recurringImpact.value.map((r) => (
                  <div key={r.id} className="flex min-w-0 items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate text-text-secondary">
                      {r.counterpartyName} · {formatDueDateLabel(r.nextDueDate)}
                    </span>
                    <span className={`shrink-0 font-semibold tabular-nums ${r.direction === "payable" ? "text-danger" : "text-success"}`}>
                      {formatCentsAsCurrency(r.amountCents, "TRY")}
                    </span>
                  </div>
                ))}
              </div>
            )
          ) : (
            <CardError />
          )}
        </DashboardCard>

        <div className="rounded-2xl border border-dashed border-border-strong p-4 text-center text-xs text-text-muted md:col-span-2 lg:col-span-3">
          CSV/PDF dışa aktarma — yakında.
        </div>
      </div>
    </AppShell>
  );
}
