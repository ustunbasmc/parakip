import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { dispatchPendingPushes } from "@/lib/push/send";

/**
 * Veritabanı (pg_net) yeni bildirim oluştuğunda bu ucu çağırır. Anahtar
 * yalnızca veritabanında üretilir (app_runtime_config, migration 0069);
 * burada service_role ile okunup karşılaştırılır. Uç idempotenttir:
 * yalnızca bekleyen bildirimleri gönderir.
 */
let cachedToken: string | null = null;

async function expectedToken(): Promise<string | null> {
  if (cachedToken) return cachedToken;
  const { data, error } = await createServiceRoleClient().rpc("get_push_dispatch_token");
  if (error || typeof data !== "string") return null;
  cachedToken = data;
  return data;
}

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function POST(request: Request) {
  const provided = request.headers.get("x-dispatch-token") ?? "";
  const expected = await expectedToken();
  if (!provided || !expected || !safeEqual(provided, expected)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }
  try {
    const result = await dispatchPendingPushes();
    return NextResponse.json(result);
  } catch (err) {
    console.error("push dispatch failed", err);
    return NextResponse.json({ error: "Gönderim başarısız." }, { status: 500 });
  }
}
