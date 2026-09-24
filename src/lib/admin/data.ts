import "server-only";
import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import { getAdminDbClient } from "@/lib/admin/auth";
import { zonedIsoDate } from "@/lib/format/tz";

/**
 * Admin panelinin ortak veri yardımcıları. Tümü service_role ile çalışır;
 * çağıran sayfa/aksiyon admin doğrulamasını ÖNCEDEN yapmış olmalıdır
 * (admin/layout.tsx ve her aksiyondaki assertAdmin).
 */

export interface AuthUserInfo {
  id: string;
  email: string | null;
  createdAt: string;
  lastSignInAt: string | null;
  emailConfirmedAt: string | null;
  bannedUntil: string | null;
  providers: string[];
  /** Kayıt kaynağı (tanıtım sayfası / kampanya), bkz. lib/marketing/attribution.ts. */
  signupSource: { page?: string; utm_source?: string; utm_medium?: string; utm_campaign?: string } | null;
}

function toInfo(u: User): AuthUserInfo {
  const banned = (u as User & { banned_until?: string | null }).banned_until ?? null;
  return {
    id: u.id,
    email: u.email ?? null,
    createdAt: u.created_at,
    lastSignInAt: u.last_sign_in_at ?? null,
    emailConfirmedAt: u.email_confirmed_at ?? null,
    bannedUntil: banned && new Date(banned).getTime() > Date.now() ? banned : null,
    providers: ((u.app_metadata?.providers as string[] | undefined) ?? [u.app_metadata?.provider as string]).filter(Boolean),
    signupSource: (u.user_metadata?.signup_source as AuthUserInfo["signupSource"]) ?? null,
  };
}

/**
 * Tüm auth kullanıcıları (e-posta, son giriş, askı durumu). E-posta
 * profiles tablosunda tutulmadığı için buradan okunur. İstek başına bir kez
 * çalışır (React cache). Güvenlik sınırı: en fazla 20.000 kullanıcı.
 */
export const getAuthUsers = cache(async (): Promise<Map<string, AuthUserInfo>> => {
  const supabase = getAdminDbClient();
  const map = new Map<string, AuthUserInfo>();
  const perPage = 1000;
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) break;
    for (const u of data.users) map.set(u.id, toInfo(u));
    if (data.users.length < perPage) break;
  }
  return map;
});

export async function getAuthUser(id: string): Promise<AuthUserInfo | null> {
  const { data, error } = await getAdminDbClient().auth.admin.getUserById(id);
  if (error || !data.user) return null;
  return toInfo(data.user);
}

/** Sayfalı okuma — PostgREST'in 1000 satır sınırını aşmak için. */
export async function fetchAllRows<T>(
  query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  max = 20_000
): Promise<T[]> {
  const out: T[] = [];
  const page = 1000;
  for (let from = 0; from < max; from += page) {
    const { data, error } = await query(from, from + page - 1);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < page) break;
  }
  return out;
}

export interface DayBucket {
  date: string; // YYYY-MM-DD (İstanbul)
  count: number;
}

/** Son `days` günün İstanbul takvim günlerine göre sayımı (bugün dahil). */
export function bucketByDay(timestamps: string[], days: number, now = new Date()): DayBucket[] {
  const buckets: DayBucket[] = [];
  const index = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) {
    const date = zonedIsoDate(new Date(now.getTime() - i * 86_400_000));
    if (index.has(date)) continue;
    index.set(date, buckets.length);
    buckets.push({ date, count: 0 });
  }
  for (const ts of timestamps) {
    const i = index.get(zonedIsoDate(new Date(ts)));
    if (i !== undefined) buckets[i].count++;
  }
  return buckets;
}

export function isSubscriptionActive(s: { status: string; current_period_end: string | null }): boolean {
  return s.status === "active" && (s.current_period_end === null || new Date(s.current_period_end).getTime() > Date.now());
}

/** Abonelik kaynağı — metadata'dan (Shopier / havale / admin). */
export function subscriptionSource(metadata: unknown): string {
  const m = (metadata ?? {}) as Record<string, unknown>;
  if (m.shopier_payment_id) return "Shopier";
  if (m.manual_bank_transfer) return "Havale";
  if (m.granted_by_admin) return "Admin";
  return "Diğer";
}

export function displayNameOf(p: { display_name?: string | null; first_name?: string | null; last_name?: string | null } | null | undefined) {
  if (!p) return null;
  const full = `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim();
  // display_name kayıt sırasında e-posta ile doldurulur (bkz. 0002) — ad soyad varsa o tercih edilir.
  return full || p.display_name || null;
}

const dateFmt = new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeZone: "Europe/Istanbul" });
const dateTimeFmt = new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Istanbul" });

export function fmtDate(iso: string | null | undefined) {
  return iso ? dateFmt.format(new Date(iso)) : "—";
}
export function fmtDateTime(iso: string | null | undefined) {
  return iso ? dateTimeFmt.format(new Date(iso)) : "—";
}

export function fmtRelative(iso: string | null | undefined, now = Date.now()) {
  if (!iso) return "—";
  const diff = now - new Date(iso).getTime();
  const min = Math.round(diff / 60_000);
  if (min < 1) return "az önce";
  if (min < 60) return `${min} dk önce`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} sa önce`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d} gün önce`;
  return fmtDate(iso);
}

export const PLAN_LABELS: Record<string, string> = { home_premium: "Ev Premium", business: "İşletme Premium" };
export const SUB_STATUS_LABELS: Record<string, string> = {
  active: "Aktif",
  inactive: "Pasif",
  trialing: "Deneme",
  cancelled: "İptal",
};
export const ROLE_LABELS: Record<string, string> = { owner: "Sahip", admin: "Yönetici", editor: "Düzenleyici", viewer: "İzleyici" };

/** platform_admin_audit_log.action → okunur etiket. */
export const ACTION_LABELS: Record<string, string> = {
  update_profile: "Profil güncellendi",
  cancel_transaction: "İşlem iptal edildi",
  approve_manual_payment: "Havale onaylandı",
  reject_manual_payment: "Havale reddedildi",
  support_reply: "Destek yanıtı yazıldı",
  support_internal_note: "Destek iç notu eklendi",
  support_status_change: "Talep durumu değişti",
  support_link_article: "Talebe makale bağlandı",
  help_article_create: "Makale oluşturuldu",
  help_article_update: "Makale güncellendi",
  help_article_publish: "Makale yayınlandı",
  help_article_unpublish: "Makale yayından kaldırıldı",
  help_article_archive: "Makale arşivlendi",
  help_category_create: "Kategori oluşturuldu",
  help_category_update: "Kategori güncellendi",
  help_category_activate: "Kategori aktifleşti",
  help_category_deactivate: "Kategori pasife alındı",
  subscription_extend: "Abonelik uzatıldı / verildi",
  subscription_cancel: "Abonelik iptal edildi",
  user_ban: "Kullanıcı askıya alındı",
  user_unban: "Askı kaldırıldı",
  email_test: "Test e-postası gönderildi",
  error_resolved: "Hata çözüldü olarak işaretlendi",
  error_reopened: "Hata yeniden açıldı",
  send_broadcast: "Duyuru bildirimi gönderildi",
};

export const ENTITY_LABELS: Record<string, string> = {
  profile: "Profil",
  transaction: "İşlem",
  subscription: "Abonelik",
  support_ticket: "Destek talebi",
  help_article: "Makale",
  help_category: "Kategori",
  user: "Kullanıcı",
  space: "Alan",
  error: "Hata",
  broadcast: "Duyuru",
};

/**
 * İsteğin "şimdi" anı (ms). Admin sayfaları her istekte sunucuda bir kez
 * render edilir; zaman damgası render dışındaki bu yardımcıdan alınır.
 */
export function requestNow(): number {
  return Date.now();
}

/**
 * Kullanıcı kimliklerini görünen ada çevirir: önce profildeki ad soyad,
 * yoksa auth e-postası. Profil satırı olmayan (ör. kayıt tetikleyicisinden
 * önce açılmış) hesaplar da böylece adsız görünmez.
 */
export async function resolveUserLabels(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  const out = new Map<string, string>();
  if (unique.length === 0) return out;
  const [{ data: profiles }, authUsers] = await Promise.all([
    getAdminDbClient().from("profiles").select("user_id, display_name, first_name, last_name").in("user_id", unique.slice(0, 500)),
    getAuthUsers(),
  ]);
  const byId = new Map((profiles ?? []).map((p) => [p.user_id, p]));
  for (const id of unique) {
    out.set(id, displayNameOf(byId.get(id)) ?? authUsers.get(id)?.email ?? "Bilinmeyen kullanıcı");
  }
  return out;
}
