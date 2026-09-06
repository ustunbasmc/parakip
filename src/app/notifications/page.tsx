import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { CardEmptyState } from "@/components/dashboard/DashboardCard";
import { NotificationListItem } from "@/components/notifications/NotificationListItem";
import { MarkAllReadButton } from "@/components/notifications/MarkAllReadButton";
import { getNotifications } from "@/lib/dashboard/notifications";

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ space?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));

  if (!user) redirect("/welcome");

  const { space } = await searchParams;
  const backHref = space ? `/home?space=${space}` : "/home";

  let notifications: Awaited<ReturnType<typeof getNotifications>>;
  let loadError = false;
  try {
    notifications = await getNotifications(supabase, { limit: 50 });
  } catch {
    loadError = true;
    notifications = [];
  }

  const hasUnread = notifications.some((n) => !n.readAt);

  return (
    <AppShell variant="subpage" title="Bildirimler" backFallbackHref={backHref}>
      <div className="flex flex-col gap-3 pt-3 pb-4">
        {notifications.length > 0 ? (
          <div className="flex justify-end">
            <MarkAllReadButton disabled={!hasUnread} />
          </div>
        ) : null}

        {loadError ? (
          <p className="py-6 text-center text-sm text-danger">Bildirimler yüklenemedi. Lütfen tekrar dene.</p>
        ) : notifications.length === 0 ? (
          <CardEmptyState
            message="Henüz bildirimin yok."
            hint="Borç vadeleri, bütçe uyarıları ve transferler burada görünecek."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {notifications.map((n) => (
              <NotificationListItem key={n.id} notification={n} spaceParam={space ?? n.spaceId} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
