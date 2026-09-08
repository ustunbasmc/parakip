import type { SupabaseClient } from "@supabase/supabase-js";

export type PlanKind = "home_premium" | "business";
export type BillingPeriod = "monthly" | "yearly";

/**
 * Kısa, okunabilir bir referans kodu üretir — kullanıcı bunu banka
 * havalesi/EFT AÇIKLAMASINA yazacağı için (1) kısa, (2) rakamla harfi
 * karıştırmayan (0/O, 1/I gibi belirsiz karakterler HARİÇ tutulur), (3)
 * yeterince benzersiz (6 karakter, ~2 milyar kombinasyon) olmalıdır.
 * Gerçek BENZERSİZLİK garantisi veritabanındaki UNIQUE kısıttan gelir
 * (migration 0060) — bu fonksiyon yalnızca İYİ bir aday üretir, çakışma
 * ihtimalinde çağıran taraf tekrar dener.
 */
export function generateReferenceCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 0,O,1,I,L çıkarıldı
  let code = "PRK-";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export interface CreateManualPaymentRequestParams {
  userId: string;
  plan: PlanKind;
  spaceId: string;
  period: BillingPeriod;
  amountCents: number;
  userNote?: string | null;
}

/**
 * Yeni bir banka havalesi ödeme bildirimi oluşturur — subscriptions
 * tablosuna HİÇBİR ŞEY YAZMAZ (yalnızca bir "talep" kaydı oluşturur).
 * Referans kodu çakışması (son derece nadir, UNIQUE kısıt sayesinde
 * asla İKİ talebin AYNI kodu almasına izin verilmez) durumunda en fazla
 * 3 kez tekrar dener.
 */
export async function createManualPaymentRequest(
  client: SupabaseClient,
  params: CreateManualPaymentRequestParams
): Promise<{ referenceCode: string } | { error: string }> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const referenceCode = generateReferenceCode();
    const { error } = await client.from("manual_payment_requests").insert({
      user_id: params.userId,
      plan: params.plan,
      space_id: params.spaceId,
      period: params.period,
      amount_cents: params.amountCents,
      reference_code: referenceCode,
      user_note: params.userNote ?? null,
    });
    if (!error) return { referenceCode };
    // 23505 = unique_violation — yalnızca bu durumda tekrar dene, başka
    // hiçbir hata türünde SESSİZCE tekrar denemek YANLIŞ olur (ör. RLS
    // reddi sonsuz döngüye girmez çünkü kod her denemede DEĞİŞİR ama
    // hata AYNI kalır — üçüncü denemede yine de çıkılır).
    if (!error.message.includes("duplicate key") && !error.message.includes("unique")) {
      return { error: error.message };
    }
  }
  return { error: "Referans kodu oluşturulamadı, lütfen tekrar dene." };
}
