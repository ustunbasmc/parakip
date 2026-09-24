import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Bildirim okuma katmanı. Tüm sorgular RLS'e tabidir (notifications_select_own)
 * — başka bir kullanıcının bildirimi bu fonksiyonlarla ASLA görünmez, ekstra
 * bir kontrole gerek yoktur.
 */

export type NotificationType = "debt_due" | "budget_80" | "budget_exceeded" | "transfer_created" | "space_invite" | "support_reply" | "subscription_expiring" | "monthly_summary" | "admin_message" | "ownership_transferred";

export interface NotificationRow {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  entityType: string | null;
  entityId: string | null;
  spaceId: string | null;
  /** Yalnızca admin duyurularında: uygulama içi hedef yol. */
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

function mapRow(r: {
  id: string;
  type: string;
  title: string;
  body: string | null;
  entity_type: string | null;
  entity_id: string | null;
  space_id: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}): NotificationRow {
  return {
    id: r.id,
    type: r.type as NotificationType,
    title: r.title,
    body: r.body,
    entityType: r.entity_type,
    entityId: r.entity_id,
    spaceId: r.space_id,
    link: r.link,
    readAt: r.read_at,
    createdAt: r.created_at,
  };
}

export async function getUnreadNotificationCount(supabase: SupabaseClient): Promise<number> {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);

  if (error) throw error;
  return count ?? 0;
}

export async function getNotifications(
  supabase: SupabaseClient,
  options: { limit?: number } = {}
): Promise<NotificationRow[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("id, type, title, body, entity_type, entity_id, space_id, link, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(options.limit ?? 50);

  if (error) throw error;
  return (data ?? []).map(mapRow);
}

/**
 * Bildirime tıklanınca gidilecek sayfa (yoksa null — yalnızca okundu
 * işaretlenir). Zil balonu ve /notifications listesi aynı kuralı kullanır.
 */
export function notificationHref(
  n: Pick<NotificationRow, "entityType" | "entityId" | "spaceId"> & { link?: string | null },
  space: string | null
): string | null {
  // Admin duyurusu: yalnızca uygulama içi yol (dış siteye yönlendirme yok).
  if (n.entityType === "admin_broadcast") return n.link && n.link.startsWith("/") && !n.link.startsWith("//") ? n.link : null;
  if (!n.entityId) return null;
  if (n.entityType === "space") return `/home?space=${n.entityId}`;
  if (n.entityType === "transaction_entry") {
    const s = space ?? n.spaceId ?? "";
    return `/transactions/${n.entityId}${s ? `?space=${s}` : ""}`;
  }
  if (n.entityType === "support_ticket") return `/support/tickets/${n.entityId}`;
  if (n.entityType === "space_invitation") return "/invitations";
  if (n.entityType === "monthly_summary") return n.spaceId ? `/reports?space=${n.spaceId}` : "/reports";
  if (n.entityType === "subscription") return n.spaceId ? `/settings/plan?space=${n.spaceId}` : "/settings/plan";
  return null;
}
