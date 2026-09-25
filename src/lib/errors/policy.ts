/**
 * Hangi hataların admin → Hatalar ekranına yazılacağı.
 *
 * - Yalnızca Vercel'de çalışan sürüm kaydeder (VERCEL=1). Yerelde
 *   `next start` ile yapılan testler de NODE_ENV=production çalışır ve
 *   .env.local canlı veritabanına bağlı olduğu için aksi hâlde test
 *   sırasındaki hatalar canlı hata listesine düşerdi.
 * - İstemcinin bağlantıyı yarıda kapatması (sayfa akarken başka yere
 *   geçmek, sekmeyi kapatmak) uygulama hatası değildir; kaydedilmez.
 */
export function shouldRecordErrors(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.VERCEL === "1" && env.NODE_ENV === "production";
}

const CLIENT_ABORT = /The destination stream closed early|ResponseAborted|\bECONNRESET\b|\bEPIPE\b|socket hang up/i;

export function isClientDisconnect(error: { message?: string; name?: string; code?: unknown } | null | undefined): boolean {
  if (!error) return false;
  if (error.name === "ResponseAborted") return true;
  if (typeof error.code === "string" && (error.code === "ECONNRESET" || error.code === "EPIPE")) return true;
  return CLIENT_ABORT.test(error.message ?? "");
}
