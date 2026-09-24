import { redirect } from "next/navigation";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { PushNotificationsCard } from "@/components/settings/PushNotificationsCard";
import { NotificationPreferencesForm, type NotificationPrefs } from "@/components/settings/NotificationPreferencesForm";

/**
 * Bildirim tercihleri — notification_preferences tablosu (0048). Satır
 * yoksa tüm türler AÇIK kabul edilir (create_notification ile aynı
 * varsayılan). Kapalı bir tür için yeni bildirim oluşturulmaz; mevcut
 * bildirimler silinmez.
 */
export default async function NotificationSettingsPage() {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect("/welcome");

  const { data, error } = await supabase
    .from("notification_preferences")
    .select("debt_due, budget_alert, transfer_created, space_invite")
    .eq("user_id", user.id)
    .maybeSingle();

  const initial: NotificationPrefs = {
    debt_due: data?.debt_due ?? true,
    budget_alert: data?.budget_alert ?? true,
    transfer_created: data?.transfer_created ?? true,
    space_invite: data?.space_invite ?? true,
  };

  return (
    <AppShell variant="subpage" title="Bildirimler">
      <div className="flex flex-col gap-4 pt-4 pb-6">
        <PushNotificationsCard />
        {error ? (
          <p className="rounded-2xl border border-danger bg-danger-soft p-4 text-sm text-danger">
            Tercihler yüklenemedi. Lütfen daha sonra tekrar dene.
          </p>
        ) : (
          <NotificationPreferencesForm userId={user.id} initial={initial} />
        )}
      </div>
    </AppShell>
  );
}
