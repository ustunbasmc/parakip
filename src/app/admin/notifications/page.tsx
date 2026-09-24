import { getAdminDbClient } from "@/lib/admin/auth";
import { fmtDateTime, resolveUserLabels } from "@/lib/admin/data";
import { isPushConfigured } from "@/lib/push/send";
import { Badge, Card, CardHeader, EmptyState, ErrorBox, PageHeader, StatCard } from "@/components/admin/ui";
import { BroadcastForm } from "@/components/admin/BroadcastForm";

const AUDIENCE_LABELS: Record<string, string> = {
  all: "Tüm kullanıcılar",
  premium: "Premium",
  free: "Ücretsiz",
};

/** Admin duyuruları: kullanıcılara uygulama içi + anlık bildirim (bkz. migration 0069). */
export default async function AdminNotificationsPage() {
  const supabase = getAdminDbClient();
  const [{ data: rows, error }, devices, deviceUsers] = await Promise.all([
    supabase.from("admin_broadcasts").select("id, admin_user_id, audience, title, body, link, recipient_count, created_at").order("created_at", { ascending: false }).limit(30),
    supabase.from("push_subscriptions").select("id", { count: "exact", head: true }),
    supabase.from("push_subscriptions").select("user_id"),
  ]);
  const labels = await resolveUserLabels([...new Set((rows ?? []).map((r) => r.admin_user_id).filter(Boolean) as string[])]);
  const pushReady = isPushConfigured();

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Bildirim gönder" description="Kullanıcılara duyuru gönder. Uygulama içi bildirimlerde görünür; anlık bildirimi açık cihazlara da gider." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="Anlık bildirim" value={pushReady ? "Etkin" : "Kapalı"} tone={pushReady ? "success" : "warning"} hint={pushReady ? undefined : "VAPID anahtarları tanımlı değil"} />
        <StatCard label="Kayıtlı cihaz" value={devices.count ?? 0} hint={`${new Set((deviceUsers.data ?? []).map((d) => d.user_id)).size} kullanıcı`} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Card>
          <CardHeader title="Yeni bildirim" />
          <BroadcastForm />
        </Card>

        <Card>
          <CardHeader title="Gönderilenler" subtitle="Son 30 duyuru" />
          {error ? (
            <ErrorBox message={`Liste yüklenemedi: ${error.message}`} />
          ) : !rows || rows.length === 0 ? (
            <EmptyState title="Henüz duyuru gönderilmedi." />
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {rows.map((r) => (
                <li key={r.id} className="flex flex-col gap-1 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-text-primary">{r.title}</span>
                    <Badge tone="neutral">{r.audience.startsWith("user:") ? r.audience.slice(5) : (AUDIENCE_LABELS[r.audience] ?? r.audience)}</Badge>
                    <Badge tone="success">{r.recipient_count} alıcı</Badge>
                  </div>
                  {r.body ? <p className="text-xs text-text-secondary">{r.body}</p> : null}
                  <p className="text-[11px] text-text-muted">
                    {fmtDateTime(r.created_at)}
                    {r.admin_user_id ? ` · ${labels.get(r.admin_user_id) ?? "Admin"}` : ""}
                    {r.link ? ` · ${r.link}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
