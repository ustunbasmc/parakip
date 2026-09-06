import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { SpaceManagementCard } from "@/components/spaces/SpaceManagementCard";
import { getManagedSpaces } from "@/lib/dashboard/formData";

export default async function ManageSpacesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));

  if (!user) redirect("/welcome");

  const spaces = await getManagedSpaces(supabase);

  return (
    <AppShell variant="subpage" title="Alanlarım" backFallbackHref="/home">
      <div className="flex flex-col gap-3 pt-3 pb-4">
        <p className="text-sm text-text-secondary">
          Ev ve İşletme alanlarını buradan yönetebilirsin. Arşivleme fiziksel silme değildir — geçmiş kayıtların
          hepsi korunur, istediğin zaman yeniden etkinleştirebilirsin.
        </p>
        {spaces.map((s) => (
          <SpaceManagementCard key={s.id} space={s} />
        ))}
      </div>
    </AppShell>
  );
}
