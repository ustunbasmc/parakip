import "server-only";
import webpush from "web-push";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { notificationHref } from "@/lib/dashboard/notifications";

/**
 * Web push gönderimi. Bildirim satırları veritabanında oluşur; kullanıcının
 * kayıtlı cihazı varsa `push_pending` işaretlenir ve pg_net bu modülün
 * gönderim ucunu (/api/push/dispatch) çağırır (bkz. migration 0069).
 *
 * VAPID anahtarları yoksa push sessizce kapalıdır; uygulama içi bildirimler
 * her durumda çalışır.
 */

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag?: string;
}

interface SubscriptionRow {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  hide_details: boolean;
}

let configured: boolean | null = null;

export function isPushConfigured(): boolean {
  if (configured !== null) return configured;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:destek@parakip.com";
  if (!pub || !priv) return (configured = false);
  webpush.setVapidDetails(subject, pub, priv);
  return (configured = true);
}

const HIDDEN: Omit<PushPayload, "url" | "tag"> = { title: "Parakip", body: "Yeni bir bildirimin var. Görmek için dokun." };

async function sendToSubscriptions(subs: SubscriptionRow[], build: (s: SubscriptionRow) => PushPayload) {
  const supabase = createServiceRoleClient();
  let sent = 0;
  let removed = 0;
  await Promise.all(
    subs.map(async (s) => {
      const payload = build(s);
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(s.hide_details ? { ...payload, ...HIDDEN } : payload),
          { TTL: 60 * 60 * 24, urgency: "normal" }
        );
        sent++;
        await supabase.from("push_subscriptions").update({ last_success_at: new Date().toISOString(), failure_count: 0 }).eq("id", s.id);
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        // 404/410: tarayıcı aboneliği iptal etmiş; kaydı sil.
        if (status === 404 || status === 410) {
          removed++;
          await supabase.from("push_subscriptions").delete().eq("id", s.id);
        } else {
          await supabase.rpc("increment_push_failure", { p_id: s.id }).then(
            () => undefined,
            () => undefined
          );
        }
      }
    })
  );
  return { sent, removed };
}

async function subscriptionsFor(userIds: string[]): Promise<SubscriptionRow[]> {
  if (userIds.length === 0) return [];
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth, hide_details")
    .in("user_id", userIds)
    .lt("failure_count", 20);
  if (error) throw error;
  return data ?? [];
}

/** Bekleyen bildirimleri sahiplenip gönderir. Birden çok çağrı güvenlidir. */
export async function dispatchPendingPushes(): Promise<{ notifications: number; sent: number; removed: number }> {
  if (!isPushConfigured()) return { notifications: 0, sent: 0, removed: 0 };
  const supabase = createServiceRoleClient();
  const total = { notifications: 0, sent: 0, removed: 0 };

  for (let round = 0; round < 5; round++) {
    const { data: rows, error } = await supabase.rpc("claim_push_notifications", { p_limit: 100 });
    if (error) throw error;
    if (!rows || rows.length === 0) break;
    total.notifications += rows.length;

    const subs = await subscriptionsFor([...new Set((rows as { user_id: string }[]).map((r) => r.user_id))]);
    const byUser = new Map<string, SubscriptionRow[]>();
    for (const s of subs) byUser.set(s.user_id, [...(byUser.get(s.user_id) ?? []), s]);

    for (const n of rows as {
      id: string;
      user_id: string;
      title: string;
      body: string | null;
      entity_type: string | null;
      entity_id: string | null;
      space_id: string | null;
      link: string | null;
    }[]) {
      const targets = byUser.get(n.user_id) ?? [];
      if (targets.length === 0) continue;
      const href = notificationHref({ entityType: n.entity_type, entityId: n.entity_id, spaceId: n.space_id, link: n.link }, null) ?? "/notifications";
      const r = await sendToSubscriptions(targets, () => ({ title: n.title, body: n.body ?? "", url: href, tag: n.id }));
      total.sent += r.sent;
      total.removed += r.removed;
    }
    if (rows.length < 100) break;
  }
  return total;
}

/** Ayarlar ekranındaki "Deneme bildirimi" için: yalnızca bu kullanıcının cihazları. */
export async function sendTestPush(userId: string): Promise<{ sent: number; devices: number }> {
  if (!isPushConfigured()) return { sent: 0, devices: 0 };
  const subs = await subscriptionsFor([userId]);
  const r = await sendToSubscriptions(subs, () => ({
    title: "Parakip bildirimleri açık",
    body: "Borç vadeleri, bütçe uyarıları ve aylık özetin artık bu cihaza gelecek.",
    url: "/notifications",
    tag: "parakip-test",
  }));
  return { sent: r.sent, devices: subs.length };
}
