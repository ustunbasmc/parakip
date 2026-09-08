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
  /** Client'ta ÖNCEDEN üretilip kullanıcıya gösterilmiş olan kod — burada YENİDEN üretilmez, aynen kullanılır. */
  referenceCode: string;
  userNote?: string | null;
}

/**
 * Yeni bir banka havalesi ödeme bildirimi oluşturur — subscriptions
 * tablosuna HİÇBİR ŞEY YAZMAZ (yalnızca bir "talep" kaydı oluşturur).
 * Bu fonksiyon, kullanıcı GERÇEKTEN "ödemeyi yaptım" dediği ANDA
 * çağrılmalıdır — yalnızca IBAN bilgilerini GÖRÜNTÜLEMEK için
 * ÇAĞRILMAMALIDIR (aksi halde her görüntüleme admin paneline gereksiz
 * bir "hayalet" talep düşürür).
 */
export async function createManualPaymentRequest(
  client: SupabaseClient,
  params: CreateManualPaymentRequestParams
): Promise<{ ok: true } | { error: string }> {
  const { error } = await client.from("manual_payment_requests").insert({
    user_id: params.userId,
    plan: params.plan,
    space_id: params.spaceId,
    period: params.period,
    amount_cents: params.amountCents,
    reference_code: params.referenceCode,
    user_note: params.userNote ?? null,
  });
  if (error) return { error: error.message };
  return { ok: true };
}
