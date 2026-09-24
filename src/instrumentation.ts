import type { Instrumentation } from "next";
import { errorFingerprint, sanitizePath } from "@/lib/errors/fingerprint";

/**
 * Sunucu hatalarını (sayfa render, route handler, server action, proxy)
 * app_error_events tablosuna yazar (bkz. migration 0067). Supabase REST
 * RPC'si doğrudan fetch ile çağrılır — hem Node hem Edge çalışma
 * ortamında çalışır, ek bağımlılık yok. Kayıt başarısız olursa sessizce
 * geçilir; asıl isteğin hatası zaten Next.js tarafından işlenir.
 */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key || process.env.NODE_ENV !== "production") return;

    const error = err instanceof Error ? err : new Error(String(err));
    const digest = typeof err === "object" && err !== null && "digest" in err ? String((err as { digest: unknown }).digest) : null;
    // Yönlendirme ve 404 gibi kontrollü akışlar hata değildir.
    if (digest && /^NEXT_(REDIRECT|HTTP_ERROR_FALLBACK|NOT_FOUND)/.test(digest)) return;

    const path = sanitizePath(request.path);
    const route = context.routePath || path;
    const body = {
      p_fingerprint: errorFingerprint({ source: "server", message: error.message || "Sunucu hatası", stack: error.stack, route }),
      p_source: "server",
      p_message: (error.message || "Sunucu hatası").slice(0, 500),
      p_stack: error.stack?.slice(0, 4000) ?? null,
      p_path: path,
      p_context: `${context.routeType} ${context.routePath}`.slice(0, 200),
      p_digest: digest?.slice(0, 100) ?? null,
      p_user_agent: null,
      p_user_id: null,
    };
    await fetch(`${url}/rest/v1/rpc/record_app_error`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // Raporlama hiçbir zaman hata fırlatmaz.
  }
};
