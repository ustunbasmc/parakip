import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfileHeaderInfo } from "@/lib/avatars";
import { AppShell } from "@/components/AppShell";
import { SpaceSwitcher } from "@/components/dashboard/SpaceSwitcher";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import { ProfileMenu } from "@/components/dashboard/ProfileMenu";
import { NotificationBell } from "@/components/dashboard/NotificationBell";
import { CardEmptyState } from "@/components/dashboard/DashboardCard";
import { DebtListItem } from "@/components/debts/DebtListItem";
import { CashFlowSummaryCard } from "@/components/debts/CashFlowSummaryCard";
import { PlusIcon } from "@/components/icons";
import { getUserSpacesBasic, resolveActiveSpace } from "@/lib/dashboard/formData";
import { getUnreadNotificationCount } from "@/lib/dashboard/notifications";
import { getDebts, getCashFlowSummary, type DebtDirection } from "@/lib/dashboard/debts";

const TABS: { value: string; label: string }[] = [
  { value: "all", label: "Tümü" },
  { value: "payable", label: "Borçlar" },
  { value: "receivable", label: "Alacaklar" },
];

export default async function DebtsPage({
  searchParams,
}: {
  searchParams: Promise<{ space?: string; direction?: string; status?: string }>;
}) {
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
    redirect(`/debts?space=${activeSpace.id}`);
  }

  const direction = params.direction === "payable" || params.direction === "receivable" ? params.direction : undefined;
  const showSettled = params.status === "settled";

  let unreadCount = 0;
  try {
    unreadCount = await getUnreadNotificationCount(supabase);
  } catch {
    unreadCount = 0;
  }

  let debts: Awaited<ReturnType<typeof getDebts>>;
  let summary: Awaited<ReturnType<typeof getCashFlowSummary>> | null;
  let loadError = false;
  try {
    [debts, summary] = await Promise.all([
      getDebts(supabase, activeSpace.bookId, {
        direction: direction as DebtDirection | undefined,
        status: showSettled ? undefined : "active",
      }),
      getCashFlowSummary(supabase, activeSpace.bookId),
    ]);
  } catch {
    loadError = true;
    debts = [];
    summary = null;
  }

  return (
    <AppShell
      activeSpaceType={activeSpace.type}
      title="Borçlar & Alacaklar"
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
      <div className="flex flex-col gap-4 pt-2 pb-4">
        {summary ? <CashFlowSummaryCard summary={summary} /> : null}

        <div className="flex justify-end">
          <ExportCsvButton
            headers={["Karşı taraf", "Yön", "Tutar", "Ödenen", "Kalan", "Vade", "Durum"]}
            rows={debts.map((d) => [
              d.counterpartyName,
              d.direction === "payable" ? "Borç" : "Alacak",
              (d.principalCents / 100).toFixed(2).replace(".", ","),
              (d.paidCents / 100).toFixed(2).replace(".", ","),
              (d.remainingCents / 100).toFixed(2).replace(".", ","),
              d.dueDate ?? "",
              d.status === "open" ? "Açık" : d.status === "partial" ? "Kısmi ödendi" : d.status === "paid" ? "Ödendi" : "İptal edildi",
            ])}
            filename={`borclar-alacaklar-${activeSpace.id}.csv`}
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="flex gap-1 overflow-x-auto rounded-full bg-surface-muted p-1">
            {TABS.map((tab) => (
              <Link
                key={tab.value}
                href={`/debts?space=${activeSpace.id}${tab.value === "all" ? "" : `&direction=${tab.value}`}${showSettled ? "&status=settled" : ""}`}
                className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-semibold ${
                  (tab.value === "all" && !direction) || tab.value === direction
                    ? "bg-accent text-text-on-accent"
                    : "text-text-secondary"
                }`}
              >
                {tab.label}
              </Link>
            ))}
          </div>
          <Link
            href={`/debts/new?book_id=${activeSpace.bookId}&space=${activeSpace.id}`}
            className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-text-on-accent"
            aria-label="Yeni borç/alacak ekle"
          >
            <PlusIcon size={18} />
          </Link>
        </div>

        <div className="flex items-center justify-between text-xs">
          <Link
            href={`/debts?space=${activeSpace.id}${direction ? `&direction=${direction}` : ""}${showSettled ? "" : "&status=settled"}`}
            className="font-semibold text-accent"
          >
            {showSettled ? "Yalnızca açık olanları göster" : "Kapanmış olanları da göster"}
          </Link>
          <Link href={`/debts/recurring?space=${activeSpace.id}`} className="font-semibold text-accent">
            Tekrarlayan ödemeler
          </Link>
        </div>

        {loadError ? (
          <p className="py-6 text-center text-sm text-danger">Veriler yüklenemedi. Lütfen tekrar dene.</p>
        ) : debts.length === 0 ? (
          <CardEmptyState
            message="Kayıt bulunamadı."
            hint="Sağ üstteki + ile ilk borç/alacağını ekleyebilirsin."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {debts.map((d) => (
              <DebtListItem key={d.id} debt={d} spaceParam={activeSpace.id} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
