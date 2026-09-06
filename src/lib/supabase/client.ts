import { createBrowserClient } from "@supabase/ssr";

/**
 * Yalnızca istemci bileşenlerinde ("use client") kullanılır.
 *
 * GÜVENLİK NOTU: Burada yalnızca NEXT_PUBLIC_ önekli anahtarlar kullanılır.
 * Bu anahtarlar (anon key) tasarım gereği herkese açıktır; asıl güvenlik
 * veritabanı seviyesindeki RLS (Row Level Security) politikaları tarafından
 * sağlanır. SUPABASE_SERVICE_ROLE_KEY bu dosyada ASLA kullanılmamalıdır.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
