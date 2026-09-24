"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserAndAdminStatus, getAdminDbClient, logAdminAction } from "@/lib/admin/auth";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Hata grubunu çözüldü/açık olarak işaretler. Aynı hata tekrar olursa kayıt kendiliğinden yeniden açılır. */
export async function setErrorResolved(id: string, resolved: boolean): Promise<{ ok: boolean }> {
  const { user, isAdmin } = await getCurrentUserAndAdminStatus();
  if (!user || !isAdmin || !UUID_RE.test(id)) return { ok: false };
  const { error } = await getAdminDbClient()
    .from("app_error_events")
    .update({ resolved_at: resolved ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) return { ok: false };
  await logAdminAction({ adminUserId: user.id, action: resolved ? "error_resolved" : "error_reopened", entityType: "error", entityId: id });
  revalidatePath("/admin/errors");
  revalidatePath("/admin", "layout");
  return { ok: true };
}
