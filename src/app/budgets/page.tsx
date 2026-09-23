import Link from "next/link";
import { NewBudgetButton } from "@/components/budgets/NewBudgetButton";
import { CopyBudgetsButton, type CopyCandidate } from "@/components/budgets/CopyBudgetsButton";
import { redirect } from "next/navigation";
import { createClient, getSessionUser } from "@/lib/supabase/server";
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
import { formatMonthIso, parseMonthParam, shiftMonthIso, zonedMonthIso } from "@/lib/format/tz";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";

export default async function BudgetsPage({ searchParams }: { searchParams: Promise<{ space?: string; month?: string }> }) {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect("/welcome");

  const [profileHeader, spaces] = await Promise.all([
    getProfileHeaderInfo(supabase, user.id),
    getUserSpacesBasic(supabase),
  ]);
  if (spaces.length === 0) redirect("/onboarding/space-type");

  const params = await searchParams;
  const activeSpace = resolveActiveSpace(spaces, params.space);
  if (params.space && params.space !== activeSpace.id) {
    redirect(`/budgets?space=${activeSpace.id}${params.month ? `&month=${encodeURIComponent(params.month)}` : ""}`);
  }

  let unreadCount = 0;
  try {
    unreadCount = await getUnreadNotificationCount(supabase);
  } catch {
    unreadCount = 0;
  }

  // Ay seçimi: geçmiş aylar serbestçe gezilebilir (salt okuma), ileriye
  // yalnızca bir sonraki aya kadar gidilir (önceden bütçe planlamak için).
  const currentMonth = zonedMonthIso();
  const maxMonth = shiftMonthIso(currentMonth, 1);
  const requested = parseMonthParam(params.month);
  const periodMonth = requested && requested <= maxMonth ? requested : currentMonth;
  const isPast = periodMonth < currentMonth;
  const previousMonth = shiftMonthIso(periodMonth, -1);
  const nextMonth = shiftMonthIso(periodMonth, 1);

  let budgets;
  let previousBudgets: Awaited<ReturnType<typeof getBudgets>> = [];
  let loadError = false;
  try {
    [budgets, previousBudgets] = await Promise.all([
      getBudgets(supabase, activeSpace.bookId, periodMonth),
      isPast ? Promise.resolve([]) : getBudgets(supabase, activeSpace.bookId, previousMonth).catch(() => []),
    ]);
  } catch {
    loadError = true;
    budgets = [] as Awaited<ReturnType<typeof getBudgets>>;
  }

  const monthLabel = formatMonthIso(periodMonth);
  const previousLabel = formatMonthIso(previousMonth);
  const monthHref = (m: string) =>
    m === currentMonth ? `/budgets?space=${activeSpace.id}` : `/budgets?space=${activeSpace.id}&month=${m.slice(0, 7)}`;

  // Önceki ayda olup seçili ayda henüz olmayan bütçeler (kopyalama adayları).
  const takenKeys = new Set(budgets.map((b) => b.categoryId ?? "__total__"));
  const copyCandidates: CopyCandidate[] = previousBudgets
    .filter((b) => !takenKeys.has(b.categoryId ?? "__total__"))
    .map((b) => ({ categoryId: b.categoryId, name: b.categoryName ?? "Toplam bütçe", amountCents: b.budgetCents }));

  const createHref = `/budgets/new?book_id=${activeSpace.bookId}&space=${activeSpace.id}${
    periodMonth === currentMonth ? "" : `&month=${periodMonth.slice(0, 7)}`
  }`;
  const navBtn =
    "flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-text-secondary transition-colors hover:bg-surface-muted";

  return (
    <AppShell
      helpSlug="butce-nasil-olusturulur"
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
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <Link href={monthHref(previousMonth)} className={navBtn} aria-label="Önceki ay" scroll={false}>
              <ChevronLeftIcon size={16} />
            </Link>
            <p className="min-w-0 truncate px-1 text-sm font-bold text-text-primary">{monthLabel}</p>
            {nextMonth <= maxMonth ? (
              <Link href={monthHref(nextMonth)} className={navBtn} aria-label="Sonraki ay" scroll={false}>
                <ChevronRightIcon size={16} />
              </Link>
            ) : (
              <span className={`${navBtn} pointer-events-none opacity-40`} aria-hidden="true">
                <ChevronRightIcon size={16} />
              </span>
            )}
          </div>
          {isPast ? null : (
            <NewBudgetButton bookId={activeSpace.bookId} spaceParam={activeSpace.id} periodMonth={periodMonth} />
          )}
        </div>

        {periodMonth !== currentMonth ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-surface-muted px-4 py-2.5 text-xs text-text-secondary">
            <span>{isPast ? "Geçmiş bir ayı görüntülüyorsun. Geçmiş aylara yeni bütçe eklenmez." : "Gelecek ay için önceden bütçe planlıyorsun."}</span>
            <Link href={monthHref(currentMonth)} className="font-bold text-accent" scroll={false}>
              Bu aya dön
            </Link>
          </div>
        ) : null}

        {!loadError && copyCandidates.length > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-dashed border-border-strong px-4 py-3">
            <p className="text-xs text-text-secondary">
              {previousLabel} ayında olup bu ayda olmayan {copyCandidates.length} bütçe var.
            </p>
            <CopyBudgetsButton
              bookId={activeSpace.bookId}
              targetMonth={periodMonth}
              targetLabel={monthLabel}
              sourceLabel={previousLabel}
              candidates={copyCandidates}
            />
          </div>
        ) : null}

        {loadError ? (
          <p className="py-6 text-center text-sm text-danger">Bütçeler yüklenemedi. Lütfen tekrar dene.</p>
        ) : budgets.length === 0 ? (
          <div className="surface-card rounded-3xl p-2">
            <CardEmptyState
              message={isPast ? `${monthLabel} için bütçe belirlenmemişti.` : `${monthLabel} için henüz bütçe belirlenmedi.`}
              hint={
                isPast
                  ? "Geçmiş aylarda yalnızca o ay oluşturulmuş bütçeler görüntülenir."
                  : "Toplam veya kategori bazlı bir harcama sınırı belirleyerek ne kadar harcadığını takip edebilirsin."
              }
              action={isPast ? undefined : { href: createHref, label: "Bütçe oluştur" }}
            />
          </div>
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
