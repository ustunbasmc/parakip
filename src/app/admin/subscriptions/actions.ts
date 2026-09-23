"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserAndAdminStatus, getAdminDbClient, logAdminAction } from "@/lib/admin/auth";

/**
 * Admin'in abonelik yönetimi. Server Action'lar admin layout'undan GEÇMEZ —
 * her aksiyon kendi içinde admin doğrular.
 *
 * Yazma kuralı Shopier callback'i ve havale onayıyla AYNIDIR:
 * home_premium SAHİP bazlı (owner_user_id), business ALAN bazlı (space_id);
 * her hedef için tek satır tutulur (varsa güncellenir, yoksa eklenir).
 * Otomatik yenileme yoktur; süre current_period_end ile sınırlıdır.
 */
async function assertAdmin() {
  const { user, isAdmin } = await getCurrentUserAndAdminStatus();
  if (!user || !isAdmin) throw new Error("Yetkisiz.");
  return user;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Result = { ok: true; periodEnd?: string } | { ok: false; error: string };

export interface ManageSubscriptionInput {
  plan: "home_premium" | "business";
  /** home_premium için kullanıcı kimliği, business için alan kimliği. */
  targetId: string;
  action: "extend" | "cancel";
  /** extend için 1–24 ay. */
  months?: number;
  note?: string;
}

export async function manageSubscription(input: ManageSubscriptionInput): Promise<Result> {
  const admin = await assertAdmin();
  if (input.plan !== "home_premium" && input.plan !== "business") return { ok: false, error: "Geçersiz plan." };
  if (!UUID_RE.test(input.targetId)) return { ok: false, error: "Geçersiz hedef." };
  const note = (input.note ?? "").trim().slice(0, 300);
  const supabase = getAdminDbClient();

  // Hedefin var olduğunu doğrula.
  if (input.plan === "home_premium") {
    const { data } = await supabase.from("profiles").select("user_id").eq("user_id", input.targetId).maybeSingle();
    if (!data) return { ok: false, error: "Kullanıcı bulunamadı." };
  } else {
    const { data } = await supabase.from("spaces").select("id, type").eq("id", input.targetId).maybeSingle();
    if (!data) return { ok: false, error: "Alan bulunamadı." };
    if (data.type !== "business") return { ok: false, error: "İşletme Premium yalnızca işletme alanlarına verilebilir." };
  }

  const targetColumn = input.plan === "home_premium" ? "owner_user_id" : "space_id";
  const { data: existing } = await supabase
    .from("subscriptions")
    .select("id, status, current_period_end, metadata")
    .eq("plan", input.plan)
    .eq(targetColumn, input.targetId)
    .maybeSingle();

  const now = new Date();

  if (input.action === "cancel") {
    if (!existing) return { ok: false, error: "İptal edilecek abonelik yok." };
    const { error } = await supabase
      .from("subscriptions")
      .update({
        status: "cancelled",
        updated_at: now.toISOString(),
        metadata: { ...((existing.metadata as object) ?? {}), cancelled_by_admin: admin.id, cancelled_at: now.toISOString(), admin_note: note || null },
      })
      .eq("id", existing.id);
    if (error) return { ok: false, error: error.message };

    await logAdminAction({
      adminUserId: admin.id,
      action: "subscription_cancel",
      entityType: "subscription",
      entityId: existing.id,
      detail: { plan: input.plan, targetId: input.targetId, previousStatus: existing.status, note: note || null },
    });
  } else {
    const months = Math.round(Number(input.months));
    if (!Number.isFinite(months) || months < 1 || months > 24) return { ok: false, error: "Süre 1–24 ay arasında olmalı." };

    // Hâlâ aktif bir süre varsa onun sonuna eklenir; yoksa bugünden başlar.
    const currentEnd = existing?.current_period_end ? new Date(existing.current_period_end) : null;
    const base = existing?.status === "active" && currentEnd && currentEnd > now ? currentEnd : now;
    const periodEnd = new Date(base);
    periodEnd.setMonth(periodEnd.getMonth() + months);

    const row = {
      plan: input.plan,
      owner_user_id: input.plan === "home_premium" ? input.targetId : null,
      space_id: input.plan === "business" ? input.targetId : null,
      status: "active" as const,
      current_period_end: periodEnd.toISOString(),
      updated_at: now.toISOString(),
      metadata: {
        ...((existing?.metadata as object) ?? {}),
        granted_by_admin: admin.id,
        granted_months: months,
        granted_at: now.toISOString(),
        admin_note: note || null,
      },
    };

    const { data: saved, error } = existing
      ? await supabase.from("subscriptions").update(row).eq("id", existing.id).select("id").single()
      : await supabase.from("subscriptions").insert(row).select("id").single();
    if (error) return { ok: false, error: error.message };

    await logAdminAction({
      adminUserId: admin.id,
      action: "subscription_extend",
      entityType: "subscription",
      entityId: saved.id,
      detail: { plan: input.plan, targetId: input.targetId, months, periodEnd: periodEnd.toISOString(), note: note || null },
    });

    revalidateTargets(input);
    return { ok: true, periodEnd: periodEnd.toISOString() };
  }

  revalidateTargets(input);
  return { ok: true };
}

function revalidateTargets(input: ManageSubscriptionInput) {
  revalidatePath("/admin/subscriptions");
  revalidatePath("/admin");
  revalidatePath(input.plan === "home_premium" ? `/admin/users/${input.targetId}` : `/admin/spaces/${input.targetId}`);
}
