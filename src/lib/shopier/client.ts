import "server-only";
import { createHmac, randomInt } from "crypto";

/**
 * Shopier — resmi bir Node.js SDK'sı YOK, harici bir paket bağımlılığı
 * (Iyzico'daki `iyzipay` gibi) da GEREKMEZ; algoritma basit (HMAC-SHA256
 * imzalama + form-post) olduğundan burada minimal, bağımsız bir istemci
 * yazılmıştır. Bu dosya YALNIZCA sunucu tarafı (API route) kodundan
 * içeri aktarılmalıdır — `server-only` paketi bunu derleme zamanında
 * zorunlu kılar. SHOPIER_API_SECRET asla istemciye gönderilmez.
 *
 * ÖNEMLİ SINIRLAMA: Shopier'ın GERÇEK, otomatik yenilenen bir "abonelik"
 * (recurring payment) API'si YOKTUR — yalnızca tek seferlik ödeme
 * alınabilir. Bu yüzden Parakip'teki "İşletme aboneliği" burada MANUEL
 * YENİLEMELİ bir paket satışı olarak uygulanır: kullanıcı ödeme
 * yaptığında current_period_end = şimdi + 30/365 gün olarak ayarlanır;
 * süre dolunca kullanıcı TEKRAR /settings/plan'a gelip satın almalıdır
 * — otomatik kart çekimi YOKTUR. Bu, kullanıcıya arayüzde AÇIKÇA
 * belirtilir (sahte bir "otomatik yenilenir" izlenimi verilmez).
 */

export type ShopierPeriod = "monthly" | "yearly";

interface ShopierConfig {
  apiKey: string;
  apiSecret: string;
}

function getConfig(): ShopierConfig {
  const apiKey = process.env.SHOPIER_API_KEY;
  const apiSecret = process.env.SHOPIER_API_SECRET;
  if (!apiKey || !apiSecret) {
    throw new Error("SHOPIER_API_KEY veya SHOPIER_API_SECRET tanımlı değil.");
  }
  return { apiKey, apiSecret };
}

function sign(data: string, secret: string): string {
  return createHmac("sha256", secret).update(data).digest("base64");
}

export interface BuildCheckoutFormParams {
  platformOrderId: string;
  productName: string;
  totalOrderValue: string; // "299.00" formatında, nokta ondalık ayraç
  buyerName: string;
  buyerSurname: string;
  buyerEmail: string;
  buyerPhone?: string;
  callbackUrl: string;
}

/**
 * Kullanıcıyı Shopier'ın ödeme sayfasına GÖTÜRECEK, kendi kendine
 * submit olan bir HTML `<form>` üretir. Kart bilgisi HİÇBİR ZAMAN
 * Parakip'e uğramaz — kullanıcı doğrudan Shopier'ın güvenli sayfasında
 * kart girer.
 */
export function buildCheckoutForm(params: BuildCheckoutFormParams): string {
  const { apiKey, apiSecret } = getConfig();
  const randomNr = randomInt(100000, 999999).toString();
  const currency = "0"; // 0 = TRY (Shopier para birimi kodu)

  const signature = sign(randomNr + params.platformOrderId + params.totalOrderValue + currency, apiSecret);

  const fields: Record<string, string> = {
    API_key: apiKey,
    website_index: "1",
    platform_order_id: params.platformOrderId,
    product_name: params.productName,
    product_type: "1", // 1 = dijital ürün (kargo adresi gerektirmez)
    buyer_name: params.buyerName,
    buyer_surname: params.buyerSurname,
    buyer_email: params.buyerEmail,
    buyer_account_age: "0",
    buyer_id_nr: "0",
    buyer_phone: params.buyerPhone || "",
    billing_address: "Belirtilmedi",
    billing_city: "İstanbul",
    billing_country: "Türkiye",
    billing_postcode: "34000",
    shipping_address: "Belirtilmedi",
    shipping_city: "İstanbul",
    shipping_country: "Türkiye",
    shipping_postcode: "34000",
    total_order_value: params.totalOrderValue,
    currency,
    platform: "0",
    is_in_frame: "0",
    current_language: "0", // 0 = TR
    modul_version: "1.0.4",
    random_nr: randomNr,
    signature,
    callback: params.callbackUrl,
  };

  const inputs = Object.entries(fields)
    .map(([key, value]) => `<input type="hidden" name="${key}" value="${escapeHtml(value)}" />`)
    .join("\n");

  return `
    <form id="shopier-payment-form" method="POST" action="https://www.shopier.com/ShowProduct/api_pay4.php">
      ${inputs}
    </form>
    <script>document.getElementById("shopier-payment-form").submit();</script>
  `;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export interface ShopierCallbackPayload {
  platform_order_id?: string;
  status?: string;
  random_nr?: string;
  total_order_value?: string;
  currency?: string;
  signature?: string;
  installment?: string;
  payment_id?: string;
}

/**
 * Shopier'dan gelen callback'in İMZASINI doğrular — bu doğrulama
 * BAŞARISIZ olursa dönen "status" alanına ASLA güvenilmez (sahte bir
 * çağrı olabilir). Yalnızca imza doğrulandıktan SONRA status okunur.
 */
export function verifyCallbackSignature(payload: ShopierCallbackPayload): boolean {
  const { apiSecret } = getConfig();
  if (!payload.random_nr || !payload.platform_order_id || !payload.total_order_value || !payload.currency || !payload.signature) {
    return false;
  }
  const data = payload.random_nr + payload.platform_order_id + payload.total_order_value + payload.currency;
  const expected = sign(data, apiSecret);
  return expected === payload.signature;
}
