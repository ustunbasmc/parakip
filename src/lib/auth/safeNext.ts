/**
 * Giriş/kayıt sonrası dönülecek uygulama içi yol. Yalnızca "/" ile başlayan,
 * başka bir siteye çıkamayan göreli yollar kabul edilir; aksi halde "/".
 *
 * Neden: `${origin}${next}` birleşiminde next="@evil.com" (kullanıcı bilgisi
 * olarak yorumlanır) veya "//evil.com" (protokol-göreli) kullanıcıyı başka
 * bir siteye yönlendirebilir (açık yönlendirme).
 */
export function safeNext(value: string | null | undefined, fallback = "/"): string {
  if (!value) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  // Kontrol karakterleri ve ters eğik çizgi (tarayıcılar "/" gibi yorumlayabilir).
  if (/[\u0000-\u001f\\]/.test(value)) return fallback;
  return value;
}
