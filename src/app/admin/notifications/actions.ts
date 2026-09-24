"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserAndAdminStatus, getAdminDbClient, logAdminAction } from "@/lib/admin/auth";
import { getAuthUsers, isSubscriptionActive } from "@/lib/admin/data";

/**
 * Admin duyuruları. Server Action'lar admin layout korumasına TABİ
 * DEĞİLDİR — her aksiyon kendi içinde admin doğrulaması yapar.
 */
async function assertAdmin() {
  const { user, isAdmin } = await getCurrentUserAndAdminStatus();
  if (!user || !isAdmin) throw new Error("Yetkisiz.");
  return user;
}

export type Audience = "all" | "premium" | "free" | "user";

const AUDIENCE_LABELS: Record<Audience, string> = {
  all: "Tüm kullanıcılar",
  premium: "Premium kullanıcılar",
  free: "Ücretsiz kullanıcılar",
  user: "Tek kullanıcı",
};

async function resolveAudience(audience: Audience, email: string): Promise<{ ids: string[]; error?: string }> {
  const users = [...(await getAuthUsers()).values()].filter((u) => u.emailConfirmedAt && !u.bannedUntil);
  if (audience === "user") {
    const target = users.find((u) => u.email?.toLowerCase() === email.trim().toLowerCase());
    return target ? { ids: [target.id] } : { ids: [], error: "Bu e-postaya ait onaylı bir kullanıcı bulunamadı." };
  }
  if (audience === "all") return { ids: users.map((u) => u.id) };

  const { data, error } = await getAdminDbClient().from("subscriptions").select("owner_user_id, status, current_period_end");
  if (error) return { ids: [], error: "Abonelikler okunamadı." };
  const premium = new Set((data ?? []).filter((s) => s.owner_user_id && isSubscriptionActive(s)).map((s) => s.owner_user_id as string));
  return { ids: users.filter((u) => (audience === "premium" ? premium.has(u.id) : !premium.has(u.id))).map((u) => u.id) };
}

function readAudience(value: FormDataEntryValue | null): Audience {
  return value === "premium" || value === "free" || value === "user" ? value : "all";
}

export async function countBroadcastAudience(formData: FormData): Promise<{ ok: boolean; count: number; message?: string }> {
  await assertAdmin();
  const r = await resolveAudience(readAudience(formData.get("audience")), String(formData.get("email") ?? ""));
  return r.error ? { ok: false, count: 0, message: r.error } : { ok: true, count: r.ids.length };
}

export async function sendBroadcast(formData: FormData): Promise<{ ok: boolean; message: string }> {
  const admin = await assertAdmin();
  const audience = readAudience(formData.get("audience"));
  const email = String(formData.get("email") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const link = String(formData.get("link") ?? "").trim();

  if (!title || title.length > 120) return { ok: false, message: "Başlık 1–120 karakter olmalı." };
  if (body.length > 1000) return { ok: false, message: "Mesaj en fazla 1000 karakter olabilir." };
  if (link && (!link.startsWith("/") || link.startsWith("//"))) {
    return { ok: false, message: "Bağlantı uygulama içi bir yol olmalı (ör. /settings/plan)." };
  }

  const r = await resolveAudience(audience, email);
  if (r.error) return { ok: false, message: r.error };
  if (r.ids.length === 0) return { ok: false, message: "Bu hedef kitlede kullanıcı yok." };

  const { data, error } = await getAdminDbClient().rpc("admin_send_broadcast", {
    p_admin_user_id: admin.id,
    p_audience: audience === "user" ? `user:${email.trim().toLowerCase()}` : audience,
    p_user_ids: r.ids,
    p_title: title,
    p_body: body || null,
    p_link: link || null,
  });
  if (error) return { ok: false, message: `Gönderilemedi: ${error.message}` };

  const result = data as { id: string; count: number };
  await logAdminAction({
    adminUserId: admin.id,
    action: "send_broadcast",
    entityType: "broadcast",
    entityId: result.id,
    detail: { audience: AUDIENCE_LABELS[audience], title, recipients: result.count },
  });
  revalidatePath("/admin/notifications");
  return { ok: true, message: `Bildirim ${result.count} kullanıcıya gönderildi. Anlık bildirimi açık cihazlara birkaç saniye içinde ulaşır.` };
}
