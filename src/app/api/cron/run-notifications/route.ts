import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service";

/**
 * Bildirim zamanlayıcısının GÜVENLİ HTTP giriş noktası. pg_cron
 * kullanılabilen ortamlarda (bkz. migration 0054) bu endpoint'e HİÇ
 * gerek yoktur — pg_cron doğrudan run_scheduled_notifications()'ı
 * veritabanı içinden çağırır. pg_cron KULLANILAMIYORSA (ör. bazı
 * self-hosted/lokal Postgres kurulumları), harici bir zamanlayıcı
 * (Vercel Cron, GitHub Actions, cron-job.org vb.) bu endpoint'i günde
 * bir kez GET/POST ile çağırmalıdır.
 *
 * GÜVENLİK: Bu endpoint ANONİM ÇAĞRILAMAZ. İstek başlığındaki
 * "Authorization: Bearer <CRON_SECRET>" değeri, sunucu ortam
 * değişkeni CRON_SECRET ile eşleşmelidir. CRON_SECRET yalnızca
 * sunucu tarafında tanımlanır (NEXT_PUBLIC_* DEĞİLDİR), istemciye
 * ASLA gönderilmez. Zamanlayıcı sağlayıcısı bu sırrı kendi
 * (genellikle şifrelenmiş) ortam değişkeni deposunda saklamalıdır.
 *
 * Çağıran taraf, bu endpoint'in KENDİSİ service_role anahtarını hiç
 * görmez — yalnızca CRON_SECRET'i bilir; asıl SUPABASE_SERVICE_ROLE_KEY
 * yalnızca bu sunucu fonksiyonu içinde, sunucu ortam değişkeninden okunur.
 */
export async function POST(request: Request) {
  return handle(request);
}

export async function GET(request: Request) {
  return handle(request);
}

async function handle(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ error: "CRON_SECRET tanımlı değil." }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const provided = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!provided || provided !== expected) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }

  try {
    const supabase = createServiceRoleClient();
    const { error } = await supabase.rpc("run_scheduled_notifications");
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, ranAt: new Date().toISOString() });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Bilinmeyen hata" }, { status: 500 });
  }
}
