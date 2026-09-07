import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";

/**
 * Bir kullanıcının platform admin'i olup olmadığını kontrol eder.
 * `is_platform_admin()` fonksiyonu `authenticated` rolüne EXECUTE
 * yetkisi verildiği için normal (RLS'e tabi) client ile de
 * çağrılabilir — platform_admins TABLOSUNUN kendisi hiç ifşa
 * edilmeden yalnızca boolean sonucu döner (bkz. migration 0058).
 */
export async function getCurrentUserAndAdminStatus() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));

  if (!user) return { user: null, isAdmin: false };

  const { data: isAdmin } = await supabase.rpc("is_platform_admin", { p_user_id: user.id });
  return { user, isAdmin: Boolean(isAdmin) };
}

/**
 * Admin panelinin TÜM veri okuma/yazma işlemleri için kullanılan
 * service-role client. RLS'i TAMAMEN BYPASS EDER — bu BİLİNÇLİDİR
 * (kullanıcının açık talebiyle "tam/sınırsız erişim" sağlanıyor).
 * Her admin route'u, bu client'ı kullanmadan ÖNCE
 * `getCurrentUserAndAdminStatus()` ile admin doğrulaması YAPMALIDIR —
 * aksi halde RLS koruması hiç devrede olmadığından herkes her şeye
 * erişebilir hale gelir.
 */
export function getAdminDbClient() {
  return createServiceRoleClient();
}

/**
 * Admin panelinden yapılan bir DEĞİŞİKLİĞİ kaydeder — erişimi
 * KISITLAMAZ, yalnızca iz bırakır (bkz. migration 0058 yorumu).
 */
export async function logAdminAction(params: {
  adminUserId: string;
  action: string;
  entityType: string;
  entityId?: string;
  detail?: Record<string, unknown>;
}) {
  const supabase = getAdminDbClient();
  await supabase.from("platform_admin_audit_log").insert({
    admin_user_id: params.adminUserId,
    action: params.action,
    entity_type: params.entityType,
    entity_id: params.entityId ?? null,
    detail: params.detail ?? null,
  });
}
