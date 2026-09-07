import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { verifyCallbackSignature, type ShopierCallbackPayload } from "@/lib/shopier/client";

/**
 * Kullanıcı Shopier'ın ödeme sayfasını tamamlayıp geri döndüğünde
 * ÇAĞRILAN yol (Shopier tarayıcıyı buraya POST ile yönlendirir).
 * subscriptions tablosundaki satır BURADA oluşturulur/güncellenir.
 *
 * GÜVENLİK: İmza doğrulanmadan HİÇBİR ALANA (özellikle "status") asla
 * güvenilmez — sahte/tahrif edilmiş bir çağrı, doğru SHOPIER_API_SECRET
 * bilinmeden geçerli bir imza üretemez.
 *
 * ÖNEMLİ SINIRLAMA: Shopier'da otomatik yenilenen abonelik YOKTUR —
 * current_period_end burada MANUEL olarak (şimdi + 30/365 gün) set
 * edilir. Süre dolduğunda has_business_subscription() (migration 0054)
 * zaten "current_period_end > now()" kontrolü yaptığından, ek bir
 * "cron ile süresi dolanları pasifleştir" işlemi GEREKMEZ — süre
 * dolduğu AN otomatik olarak pasif sayılır; kullanıcı /settings/plan'a
 * dönüp TEKRAR ödeme yapmalıdır (otomatik kart çekimi yoktur, bu
 * arayüzde açıkça belirtilir).
 *
 * subscriptions tablosuna yazmak service_role gerektirir (authenticated
 * rolüne yalnızca SELECT verilmiştir, bkz. migration 0052).
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
  const spaceId = parts[0];
  const period = parts[1] === "yearly" ? "yearly" : "monthly";

  if (!spaceId) {
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

  const row = {
    plan: "business" as const,
    space_id: spaceId,
    status: "active" as const,
    current_period_end: periodEnd.toISOString(),
    metadata: {
      shopier_payment_id: payload.payment_id ?? null,
      billing_period: period,
      manual_renewal: true,
    },
    updated_at: now.toISOString(),
  };

  const { data: existingForSpace } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("plan", "business")
    .eq("space_id", spaceId)
    .maybeSingle();

  if (existingForSpace) {
    await supabase.from("subscriptions").update(row).eq("id", existingForSpace.id);
  } else {
    await supabase.from("subscriptions").insert(row);
  }

  return NextResponse.redirect(`${siteUrl}/settings/plan?space=${spaceId}&shopier_result=success`, 303);
}
