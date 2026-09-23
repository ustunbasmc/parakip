import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { getProfileHeaderInfo } from "@/lib/avatars";
import { AppShell } from "@/components/AppShell";
import { SpaceSwitcher } from "@/components/dashboard/SpaceSwitcher";
import { ProfileMenu } from "@/components/dashboard/ProfileMenu";
import { AccountCard } from "@/components/accounts/AccountCard";
import { AccountsSummaryCard } from "@/components/accounts/AccountsSummaryCard";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import { accountTypeLabel } from "@/lib/format/accountType";
import { CardEmptyState } from "@/components/dashboard/DashboardCard";
import { NewAccountButton } from "@/components/accounts/NewAccountButton";
import { getAccountsWithBalance, getUserSpacesBasic, resolveActiveSpace } from "@/lib/dashboard/formData";
import { getUnreadNotificationCount } from "@/lib/dashboard/notifications";
import { NotificationBell } from "@/components/dashboard/NotificationBell";

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ space?: string; archived?: string }>;
}) {
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
    redirect(`/accounts?space=${activeSpace.id}`);
  }
  const showArchived = params.archived === "1";

  let unreadCount = 0;
  try {
    unreadCount = await getUnreadNotificationCount(supabase);
  } catch {
    unreadCount = 0;
  }

  let accounts: Awaited<ReturnType<typeof getAccountsWithBalance>>;
  let loadError = false;
  try {
    accounts = await getAccountsWithBalance(supabase, activeSpace.bookId, { archived: showArchived });
  } catch {
    loadError = true;
    accounts = [];
  }

  return (
    <AppShell
      helpSlug="hesap-nasil-eklenir"
      activeSpaceType={activeSpace.type}
      title="Hesaplar"
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
      <div className="flex flex-wrap items-center gap-2 pt-2">
        <nav aria-label="Hesap durumu" className="flex gap-1 rounded-2xl border border-border bg-surface p-1">
          <Link
            href={`/accounts?space=${activeSpace.id}`}
            aria-current={!showArchived ? "page" : undefined}
            className={`rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors ${
              !showArchived ? "bg-accent text-text-on-accent" : "text-text-secondary hover:bg-surface-muted"
            }`}
          >
            Aktif
          </Link>
          <Link
            href={`/accounts?space=${activeSpace.id}&archived=1`}
            aria-current={showArchived ? "page" : undefined}
            className={`rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors ${
              showArchived ? "bg-accent text-text-on-accent" : "text-text-secondary hover:bg-surface-muted"
            }`}
          >
            Arşivlenmiş
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <ExportCsvButton
            headers={["Hesap adı", "Tür", "Para birimi", "Bakiye", "Durum"]}
            rows={accounts.map((a) => [
              a.name,
              accountTypeLabel(a.type),
              a.currency,
              (a.balanceCents / 100).toFixed(2).replace(".", ","),
              a.isArchived ? "Arşivlenmiş" : "Aktif",
            ])}
            filename={`hesaplar-${activeSpace.id}.csv`}
          />
          <NewAccountButton bookId={activeSpace.bookId} spaceParam={activeSpace.id} />
        </div>
      </div>

      {!loadError && !showArchived && accounts.length > 0 ? (
        <div className="mt-3">
          <AccountsSummaryCard accounts={accounts} />
        </div>
      ) : null}

      <div className="mt-3 grid grid-cols-1 gap-2.5 pb-4 md:grid-cols-2">
        {loadError ? (
          <p className="py-6 text-center text-sm text-danger">Hesaplar yüklenemedi. Lütfen tekrar dene.</p>
        ) : accounts.length === 0 ? (
          <div className="surface-card rounded-3xl p-2 md:col-span-2">
          <CardEmptyState
            message={showArchived ? "Arşivlenmiş hesap yok." : "Henüz hesap eklenmedi."}
            hint={showArchived ? undefined : "Banka, nakit veya kart hesabını ekleyerek bakiyelerini takip etmeye başla."}
            action={showArchived ? undefined : { href: `/accounts/new?book_id=${activeSpace.bookId}&space=${activeSpace.id}`, label: "Hesap ekle" }}
          />
          </div>
        ) : (
          accounts.map((a) => <AccountCard key={a.id} account={a} spaceParam={activeSpace.id} />)
        )}
      </div>
    </AppShell>
  );
}
