import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfileHeaderInfo } from "@/lib/avatars";
import { AppShell } from "@/components/AppShell";
import { SpaceSwitcher } from "@/components/dashboard/SpaceSwitcher";
import { ProfileMenu } from "@/components/dashboard/ProfileMenu";
import { AccountCard } from "@/components/accounts/AccountCard";
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
        <div className="flex gap-1 rounded-full bg-surface-muted p-1">
          <Link
            href={`/accounts?space=${activeSpace.id}`}
            className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${
              !showArchived ? "bg-accent text-text-on-accent" : "text-text-secondary"
            }`}
          >
            Aktif
          </Link>
          <Link
            href={`/accounts?space=${activeSpace.id}&archived=1`}
            className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${
              showArchived ? "bg-accent text-text-on-accent" : "text-text-secondary"
            }`}
          >
            Arşivlenmiş
          </Link>
        </div>
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

      <div className="mt-3 flex flex-col gap-2.5 pb-4">
        {loadError ? (
          <p className="py-6 text-center text-sm text-danger">Hesaplar yüklenemedi. Lütfen tekrar dene.</p>
        ) : accounts.length === 0 ? (
          <CardEmptyState
            message={showArchived ? "Arşivlenmiş hesap yok." : "Henüz hesap eklenmedi."}
            hint={showArchived ? undefined : "Sağ üstteki + ile ilk hesabını ekleyebilirsin."}
          />
        ) : (
          accounts.map((a) => <AccountCard key={a.id} account={a} spaceParam={activeSpace.id} />)
        )}
      </div>
    </AppShell>
  );
}
