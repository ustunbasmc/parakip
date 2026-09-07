import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfileHeaderInfo } from "@/lib/avatars";
import { AppShell } from "@/components/AppShell";
import { SpaceSwitcher } from "@/components/dashboard/SpaceSwitcher";
import { ProfileMenu } from "@/components/dashboard/ProfileMenu";
import { CardEmptyState } from "@/components/dashboard/DashboardCard";
import { PartyListItem } from "@/components/parties/PartyListItem";
import { NewPartyButton } from "@/components/parties/NewPartyButton";
import { getUserSpacesBasic, resolveActiveSpace } from "@/lib/dashboard/formData";
import { getCustomers } from "@/lib/dashboard/customers";

export default async function CustomersPage({
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

  // Müşteri yönetimi yalnızca İşletme alanları içindir.
  if (activeSpace.type !== "business") {
    const business = spaces.find((s) => s.type === "business");
    redirect(business ? `/customers?space=${business.id}` : "/home");
  }

  const showArchived = params.archived === "1";
  let customers: Awaited<ReturnType<typeof getCustomers>>;
  let loadError = false;
  try {
    customers = await getCustomers(supabase, activeSpace.id, { archived: showArchived });
  } catch {
    loadError = true;
    customers = [];
  }

  const businessSpaces = spaces.filter((s) => s.type === "business");

  return (
    <AppShell
      title="Müşteriler"
      headerEnd={
        <div className="flex items-center gap-2">
          {businessSpaces.length > 1 ? (
            <SpaceSwitcher options={businessSpaces.map((s) => ({ id: s.id, type: s.type, name: s.name }))} activeId={activeSpace.id} />
          ) : null}
          <ProfileMenu displayName={profileHeader.displayName} email={user.email ?? null} avatarUrl={profileHeader.avatarUrl} />
        </div>
      }
    >
      <div className="flex items-center gap-2 pt-2">
        <div className="flex gap-1 rounded-full bg-surface-muted p-1">
          <Link
            href={`/customers?space=${activeSpace.id}`}
            className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${!showArchived ? "bg-accent text-text-on-accent" : "text-text-secondary"}`}
          >
            Aktif
          </Link>
          <Link
            href={`/customers?space=${activeSpace.id}&archived=1`}
            className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${showArchived ? "bg-accent text-text-on-accent" : "text-text-secondary"}`}
          >
            Arşivlenmiş
          </Link>
        </div>
        <NewPartyButton type="customer" spaceId={activeSpace.id} spaceParam={activeSpace.id} />
      </div>

      <div className="mt-3 flex flex-col gap-2.5 pb-4">
        {loadError ? (
          <p className="py-6 text-center text-sm text-danger">Müşteriler yüklenemedi.</p>
        ) : customers.length === 0 ? (
          <CardEmptyState message={showArchived ? "Arşivlenmiş müşteri yok." : "Henüz müşteri eklenmedi."} hint={showArchived ? undefined : "Sağ üstteki + ile ekleyebilirsin."} />
        ) : (
          customers.map((c) => <PartyListItem key={c.id} party={c} href={`/customers/${c.id}?space=${activeSpace.id}`} type="customer" />)
        )}
      </div>
    </AppShell>
  );
}
