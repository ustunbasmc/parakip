import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { sanitizePath } from "@/lib/errors/fingerprint";

/**
 * Tarayıcı hata bildirimi (bkz. lib/errors/reportClient.ts). Oturum
 * gerekmez (giriş ekranındaki hatalar da görülsün diye); kötüye kullanıma
 * karşı: boyut sınırı, alan kırpma, örnek başına basit hız sınırı ve
 * veritabanında saatlik yeni hata türü sınırı (record_app_error).
 */
const MAX_BODY = 8 * 1024;
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 30;
const hits = new Map<string, { count: number; reset: number }>();

function limited(ip: string): boolean {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || h.reset < now) {
    hits.set(ip, { count: 1, reset: now + WINDOW_MS });
    if (hits.size > 5000) hits.clear();
    return false;
  }
  h.count++;
  return h.count > MAX_PER_WINDOW;
}

const str = (v: unknown, max: number) => (typeof v === "string" && v.length > 0 ? v.slice(0, max) : null);

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (limited(ip)) return new NextResponse(null, { status: 204 });

  const raw = await request.text().catch(() => "");
  if (!raw || raw.length > MAX_BODY) return new NextResponse(null, { status: 204 });

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new NextResponse(null, { status: 204 });
  }
  const fingerprint = str(payload.fingerprint, 64);
  const message = str(payload.message, 500);
  if (!fingerprint || !/^[0-9a-f]{16}$/.test(fingerprint) || !message) return new NextResponse(null, { status: 204 });

  let userId: string | null = null;
  try {
    userId = (await getSessionUser(await createClient()))?.id ?? null;
  } catch {
    userId = null;
  }

  try {
    await createServiceRoleClient().rpc("record_app_error", {
      p_fingerprint: fingerprint,
      p_source: "client",
      p_message: message,
      p_stack: str(payload.stack, 4000),
      p_path: sanitizePath(str(payload.path, 300)),
      p_context: str(payload.context, 200),
      p_digest: str(payload.digest, 100),
      p_user_agent: str(request.headers.get("user-agent"), 300),
      p_user_id: userId,
    });
  } catch {
    // Kayıt başarısızsa istemciye yine 204 — raporlama kullanıcıyı etkilemez.
  }
  return new NextResponse(null, { status: 204 });
}
