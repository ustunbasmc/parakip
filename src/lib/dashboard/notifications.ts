import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Bildirim okuma katmanı. Tüm sorgular RLS'e tabidir (notifications_select_own)
 * — başka bir kullanıcının bildirimi bu fonksiyonlarla ASLA görünmez, ekstra
 * bir kontrole gerek yoktur.
 */

export type NotificationType = "debt_due" | "budget_80" | "budget_exceeded" | "transfer_created" | "space_invite";

export interface NotificationRow {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  entityType: string | null;
  entityId: string | null;
  spaceId: string | null;
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
    .select("id, type, title, body, entity_type, entity_id, space_id, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(options.limit ?? 50);

  if (error) throw error;
  return (data ?? []).map(mapRow);
}
