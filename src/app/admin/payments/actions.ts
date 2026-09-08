"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserAndAdminStatus, getAdminDbClient, logAdminAction } from "@/lib/admin/auth";

/**
 * Server Action'lar middleware'DEN GEÇMEZ — HER action kendi İÇİNDE
 * admin doğrulaması YAPMAK ZORUNDADIR (bkz. users/[id]/actions.ts'teki
 * AYNI uyarı).
 */
async function assertAdmin() {
  const { user, isAdmin } = await getCurrentUserAndAdminStatus();
  if (!user || !isAdmin) {
    throw new Error("Yetkisiz.");
  }
  return user;
}

/**
 * Bir banka havalesi ödeme talebini ONAYLAR — bu, subscriptions
 * tablosuna GERÇEKTEN yazılan TEK an'dır (Shopier callback'indeki AYNI
 * mantık: home_premium sahip bazlı, business alan bazlı; süre = şimdi +
 * 30/365 gün, otomatik yenileme YOKTUR).
 */
export async function approvePaymentRequest(requestId: string) {
  const admin = await assertAdmin();
  const supabase = getAdminDbClient();

  const { data: request, error: fetchError } = await supabase
    .from("manual_payment_requests")
    .select("id, user_id, plan, space_id, period, status")
    .eq("id", requestId)
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message);
  if (!request) throw new Error("Talep bulunamadı.");
  if (request.status !== "pending") throw new Error("Bu talep zaten işleme alınmış.");

  const now = new Date();
  const periodEnd = new Date(now);
  if (request.period === "yearly") periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  else periodEnd.setMonth(periodEnd.getMonth() + 1);

  const baseRow = {
    status: "active" as const,
    current_period_end: periodEnd.toISOString(),
    metadata: { manual_bank_transfer: true, billing_period: request.period, approved_request_id: request.id },
    updated_at: now.toISOString(),
  };

  if (request.plan === "home_premium") {
    const { data: space } = await supabase.from("spaces").select("owner_user_id").eq("id", request.space_id).maybeSingle();
    if (!space?.owner_user_id) throw new Error("Alan sahibi bulunamadı.");

    const row = { ...baseRow, plan: "home_premium" as const, owner_user_id: space.owner_user_id, space_id: null };
    const { data: existing } = await supabase
      .from("subscriptions")
      .select("id")
      .eq("plan", "home_premium")
      .eq("owner_user_id", space.owner_user_id)
      .maybeSingle();

    if (existing) await supabase.from("subscriptions").update(row).eq("id", existing.id);
    else await supabase.from("subscriptions").insert(row);
  } else {
    const row = { ...baseRow, plan: "business" as const, space_id: request.space_id, owner_user_id: null };
    const { data: existing } = await supabase
      .from("subscriptions")
      .select("id")
      .eq("plan", "business")
      .eq("space_id", request.space_id)
      .maybeSingle();

    if (existing) await supabase.from("subscriptions").update(row).eq("id", existing.id);
    else await supabase.from("subscriptions").insert(row);
  }

  const { error: updateError } = await supabase
    .from("manual_payment_requests")
    .update({ status: "approved", reviewed_by: admin.id, reviewed_at: now.toISOString() })
    .eq("id", requestId);
  if (updateError) throw new Error(updateError.message);

  await logAdminAction({
    adminUserId: admin.id,
    action: "approve_manual_payment",
    entityType: "subscription",
    entityId: requestId,
    detail: { plan: request.plan, period: request.period, spaceId: request.space_id },
  });

  revalidatePath("/admin/payments");
}

export async function rejectPaymentRequest(requestId: string, adminNote: string) {
  const admin = await assertAdmin();
  const supabase = getAdminDbClient();

  const { error } = await supabase
    .from("manual_payment_requests")
    .update({ status: "rejected", reviewed_by: admin.id, reviewed_at: new Date().toISOString(), admin_note: adminNote || null })
    .eq("id", requestId)
    .eq("status", "pending");
  if (error) throw new Error(error.message);

  await logAdminAction({
    adminUserId: admin.id,
    action: "reject_manual_payment",
    entityType: "subscription",
    entityId: requestId,
  });

  revalidatePath("/admin/payments");
}
