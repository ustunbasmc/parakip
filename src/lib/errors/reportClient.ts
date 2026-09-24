import { errorFingerprint, sanitizePath } from "./fingerprint";

/**
 * Tarayıcı hatalarını /api/client-errors'a bildirir. Sayfa başına en fazla
 * 10 farklı hata, aynı hata bir kez gönderilir; kişisel veri gönderilmez
 * (yalnızca mesaj, kırpılmış yığın ve sorgusuz yol). Bildirim başarısız
 * olursa sessizce vazgeçilir — kullanıcı deneyimini asla etkilemez.
 */
const sent = new Set<string>();
const MAX_PER_PAGE = 10;

/** Tarayıcı eklentileri ve zararsız tarayıcı uyarıları gibi gürültü. */
function isNoise(message: string, stack: string | undefined): boolean {
  return (
    /ResizeObserver loop|Script error\.?$|^Load failed$|NetworkError when attempting to fetch|AbortError/i.test(message) ||
    /(chrome|moz|safari)-extension:\/\//.test(stack ?? "")
  );
}

export function reportClientError(error: unknown, context?: string) {
  try {
    if (typeof window === "undefined" || process.env.NODE_ENV !== "production") return;
    const err = error instanceof Error ? error : new Error(typeof error === "string" ? error : "Bilinmeyen hata");
    const message = err.message || "Bilinmeyen hata";
    if (isNoise(message, err.stack)) return;
    const path = sanitizePath(window.location.pathname);
    const fingerprint = errorFingerprint({ source: "client", message, stack: err.stack, route: path });
    if (sent.has(fingerprint) || sent.size >= MAX_PER_PAGE) return;
    sent.add(fingerprint);

    const body = JSON.stringify({
      fingerprint,
      message: message.slice(0, 500),
      stack: err.stack?.slice(0, 4000) ?? null,
      path,
      context: context?.slice(0, 200) ?? null,
      digest: (err as Error & { digest?: string }).digest ?? null,
    });
    const blob = new Blob([body], { type: "application/json" });
    if (!navigator.sendBeacon?.("/api/client-errors", blob)) {
      void fetch("/api/client-errors", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => undefined);
    }
  } catch {
    // Raporlama hiçbir zaman hata fırlatmaz.
  }
}
