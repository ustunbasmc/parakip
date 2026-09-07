import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildCheckoutForm, type ShopierPeriod } from "@/lib/shopier/client";

/**
 * İşletme aboneliği için Shopier ödeme formu üretir. Kullanıcının
 * oturumunu ve seçtiği alanın (spaceId) İŞLETME tipinde olduğunu VE
 * kullanıcının o alanda owner/admin olduğunu doğrular. Bu endpoint
 * subscriptions tablosuna HİÇBİR ŞEY YAZMAZ — abonelik yalnızca
 * /api/shopier/callback GERÇEK bir "success" ödeme sonucu aldığında
 * oluşturulur ("sahte aktif abonelik gösterme" ilkesi).
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));

  if (!user) {
    return NextResponse.json({ error: "Oturum açmanız gerekiyor." }, { status: 401 });
  }

  let body: { spaceId?: string; period?: ShopierPeriod };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }

  const { spaceId, period } = body;
  if (!spaceId || (period !== "monthly" && period !== "yearly")) {
    return NextResponse.json({ error: "Alan veya ödeme dönemi eksik." }, { status: 400 });
  }

  const { data: space, error: spaceError } = await supabase
    .from("spaces")
    .select("id, type")
    .eq("id", spaceId)
    .maybeSingle();

  if (spaceError || !space || space.type !== "business") {
    return NextResponse.json({ error: "Geçersiz alan." }, { status: 400 });
  }

  const { data: membership } = await supabase
    .from("space_members")
    .select("role")
    .eq("space_id", spaceId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    return NextResponse.json({ error: "Bu işlem için yetkin yok (owner/admin gerekli)." }, { status: 403 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, phone")
    .eq("user_id", user.id)
    .maybeSingle();

  const priceEnv = period === "monthly" ? process.env.SHOPIER_MONTHLY_PRICE_TRY : process.env.SHOPIER_YEARLY_PRICE_TRY;
  const price = Number(priceEnv);
  if (!priceEnv || Number.isNaN(price) || price <= 0) {
    return NextResponse.json({ error: "Fiyat yapılandırması eksik." }, { status: 500 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  // platform_order_id: spaceId + dönem + zaman damgası — callback'te
  // hangi alana/döneme ait olduğunu buradan ÇÖZÜMLÜYORUZ, ayrı bir
  // "bekleyen sipariş" tablosu GEREKMEZ.
  const platformOrderId = `${spaceId}__${period}__${Date.now()}`;

  try {
    const formHtml = buildCheckoutForm({
      platformOrderId,
      productName: period === "monthly" ? "Parakip İşletme (Aylık)" : "Parakip İşletme (Yıllık)",
      totalOrderValue: price.toFixed(2),
      buyerName: profile?.first_name || "Parakip",
      buyerSurname: profile?.last_name || "Kullanıcı",
      buyerEmail: user.email ?? "",
      buyerPhone: profile?.phone || undefined,
      callbackUrl: `${siteUrl}/api/shopier/callback`,
    });

    return NextResponse.json({ formHtml });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Bilinmeyen hata" }, { status: 500 });
  }
}
