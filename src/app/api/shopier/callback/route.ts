import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { verifyCallbackSignature, type ShopierCallbackPayload } from "@/lib/shopier/client";

/**
 * Kullanıcı Shopier'ın ödeme sayfasını tamamlayıp geri döndüğünde
 * ÇAĞRILAN yol. subscriptions tablosundaki satır BURADA oluşturulur/
 * güncellenir — hem "home_premium" (owner_user_id bazlı) hem "business"
 * (space_id bazlı) planlar için.
 *
 * GÜVENLİK: İmza doğrulanmadan HİÇBİR ALANA (özellikle "status") asla
 * güvenilmez.
 *
 * ÖNEMLİ SINIRLAMA: Shopier'da otomatik yenilenen abonelik YOKTUR —
 * current_period_end burada MANUEL olarak (şimdi + 30/365 gün) set
 * edilir. Süre dolduğunda has_home_premium()/has_business_subscription()
 * (migration 0052/0054) zaten "current_period_end > now()" kontrolü
 * yaptığından, ek bir "cron ile pasifleştir" işlemi GEREKMEZ.
 */
export async function POST(request: Request) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  let payload: ShopierCallbackPayload = {};
  try {
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      payload = Object.fromEntries(form.entries()) as unknown as ShopierCallbackPayload;
    } else {
      payload = await request.json();
    }
  } catch {
    return NextResponse.redirect(`${siteUrl}/settings/plan?shopier_result=error`, 303);
  }

  if (!verifyCallbackSignature(payload)) {
    // İmza uyuşmuyor — sahte/bozuk çağrı olabilir, HİÇBİR VERİ YAZILMAZ.
    return NextResponse.redirect(`${siteUrl}/settings/plan?shopier_result=error`, 303);
  }

  const platformOrderId = payload.platform_order_id ?? "";
  const parts = platformOrderId.split("__");
  const plan = parts[0] === "home_premium" ? "home_premium" : parts[0] === "business" ? "business" : null;
  const spaceId = parts[1];
  const period = parts[2] === "yearly" ? "yearly" : "monthly";

  if (!plan || !spaceId) {
    return NextResponse.redirect(`${siteUrl}/settings/plan?shopier_result=error`, 303);
  }

  const isSuccess = (payload.status ?? "").toLowerCase() === "success";
  if (!isSuccess) {
    return NextResponse.redirect(`${siteUrl}/settings/plan?space=${spaceId}&shopier_result=error`, 303);
  }

  const now = new Date();
  const periodEnd = new Date(now);
  if (period === "yearly") periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  else periodEnd.setMonth(periodEnd.getMonth() + 1);

  const supabase = createServiceRoleClient();

  const baseRow = {
    status: "active" as const,
    current_period_end: periodEnd.toISOString(),
    metadata: {
      shopier_payment_id: payload.payment_id ?? null,
      billing_period: period,
      manual_renewal: true,
    },
    updated_at: now.toISOString(),
  };

  if (plan === "home_premium") {
    // home_premium SAHİP bazlıdır (owner_user_id) — spaceId'den
    // owner_user_id'yi bulup ONA göre satır yazılır (birden fazla Ev'i
    // olan bir kullanıcı, hangi Ev'den satın alırsa alsın AYNI sahip
    // satırını günceller — has_home_premium zaten owner_user_id'ye
    // bakıyor, space_id'ye değil).
    const { data: space } = await supabase.from("spaces").select("owner_user_id").eq("id", spaceId).maybeSingle();
    if (!space?.owner_user_id) {
      return NextResponse.redirect(`${siteUrl}/settings/plan?shopier_result=error`, 303);
    }

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
    const row = { ...baseRow, plan: "business" as const, space_id: spaceId, owner_user_id: null };

    const { data: existing } = await supabase
      .from("subscriptions")
      .select("id")
      .eq("plan", "business")
      .eq("space_id", spaceId)
      .maybeSingle();

    if (existing) await supabase.from("subscriptions").update(row).eq("id", existing.id);
    else await supabase.from("subscriptions").insert(row);
  }

  return NextResponse.redirect(`${siteUrl}/settings/plan?space=${spaceId}&shopier_result=success`, 303);
}
