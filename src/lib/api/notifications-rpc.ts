import type { SupabaseClient } from "@supabase/supabase-js";

type Uuid = string;

/**
 * Bildirim yazma yolu — YALNIZCA bu iki fonksiyon istemciden çağrılabilir
 * (mark_notification_read, mark_all_notifications_read). Bildirim
 * OLUŞTURMA istemciden asla yapılmaz — yalnızca sunucu tarafı trigger'lar
 * (ör. notify_transfer_created) veya service_role ile çalışan zamanlanmış
 * görevler (create_debt_due_notifications, create_budget_alert_notifications)
 * tarafından yapılır (bkz. migration 0048).
 */

export async function markNotificationRead(client: SupabaseClient, notificationId: Uuid) {
  return client.rpc("mark_notification_read", { p_notification_id: notificationId });
}

export async function markAllNotificationsRead(client: SupabaseClient) {
  return client.rpc("mark_all_notifications_read");
}
