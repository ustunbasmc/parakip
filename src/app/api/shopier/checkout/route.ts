import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildCheckoutForm, type ShopierPeriod } from "@/lib/shopier/client";

type PlanKind = "home_premium" | "business";

/**
 * Ev Premium VEYA İşletme Premium için Shopier ödeme formu üretir.
 * - "home_premium": yalnızca o Ev'in SAHİBİ (space.owner_user_id) satın
 *   alabilir — Premium kontrolü sahibe göre yapıldığı için (bkz.
 *   has_home_premium, migration 0052) başka bir üyenin satın alması
 *   anlamsız/yanıltıcı olurdu.
 * - "business": alanın owner/admin'i satın alabilir (alan bazlı).
 * Bu endpoint subscriptions tablosuna HİÇBİR ŞEY YAZMAZ — abonelik
 * yalnızca /api/shopier/callback GERÇEK bir "success" sonucu aldığında
 * oluşturulur.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));

  if (!user) {
    return NextResponse.json({ error: "Oturum açmanız gerekiyor." }, { status: 401 });
  }

  let body: { spaceId?: string; plan?: PlanKind; period?: ShopierPeriod };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }

  const { spaceId, plan, period } = body;
  if (!spaceId || (plan !== "home_premium" && plan !== "business") || (period !== "monthly" && period !== "yearly")) {
    return NextResponse.json({ error: "Alan, plan türü veya ödeme dönemi eksik." }, { status: 400 });
  }

  const { data: space, error: spaceError } = await supabase
    .from("spaces")
    .select("id, type, owner_user_id")
    .eq("id", spaceId)
    .maybeSingle();

  if (spaceError || !space) {
    return NextResponse.json({ error: "Geçersiz alan." }, { status: 400 });
  }

  if (plan === "home_premium") {
    if (space.type !== "home") {
      return NextResponse.json({ error: "Bu alan Ev tipinde değil." }, { status: 400 });
    }
    if (space.owner_user_id !== user.id) {
      return NextResponse.json({ error: "Yalnızca alanın sahibi Ev Premium satın alabilir." }, { status: 403 });
    }
  } else {
    if (space.type !== "business") {
      return NextResponse.json({ error: "Bu alan İşletme tipinde değil." }, { status: 400 });
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
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, phone")
    .eq("user_id", user.id)
    .maybeSingle();

  const priceEnvKey =
    plan === "home_premium"
      ? period === "monthly"
        ? "SHOPIER_HOME_MONTHLY_PRICE_TRY"
        : "SHOPIER_HOME_YEARLY_PRICE_TRY"
      : period === "monthly"
        ? "SHOPIER_BUSINESS_MONTHLY_PRICE_TRY"
        : "SHOPIER_BUSINESS_YEARLY_PRICE_TRY";
  const priceEnv = process.env[priceEnvKey];
  const price = Number(priceEnv);
  if (!priceEnv || Number.isNaN(price) || price <= 0) {
    return NextResponse.json({ error: "Fiyat yapılandırması eksik." }, { status: 500 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  // platform_order_id: plan__spaceId__period__timestamp — callback'te
  // hangi plana/alana/döneme ait olduğunu buradan ÇÖZÜMLÜYORUZ, ayrı
  // bir "bekleyen sipariş" tablosu GEREKMEZ. (spaceId home_premium için
  // de kullanılır — o Ev'in owner_user_id'sine callback'te space
  // sorgusuyla ulaşılır.)
  const platformOrderId = `${plan}__${spaceId}__${period}__${Date.now()}`;

  const planLabel =
    plan === "home_premium"
      ? period === "monthly"
        ? "Parakip Ev Premium (Aylık)"
        : "Parakip Ev Premium (Yıllık)"
      : period === "monthly"
        ? "Parakip İşletme Premium (Aylık)"
        : "Parakip İşletme Premium (Yıllık)";

  try {
    const formHtml = buildCheckoutForm({
      platformOrderId,
      productName: planLabel,
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
