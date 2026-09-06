import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * SERVICE_ROLE istemcisi — YALNIZCA sunucu tarafı (API route/server
 * context) kodundan içeri aktarılmalıdır. `server-only` paketi, bu
 * dosyanın yanlışlıkla bir client component'e sızması durumunda BUILD
 * HATASI verir. SUPABASE_SERVICE_ROLE_KEY asla NEXT_PUBLIC_* olarak
 * TANIMLANMAMALI ve asla istemciye GÖNDERİLMEMELİDİR — bu istemci RLS'i
 * TAMAMEN ATLAR.
 */
export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY veya NEXT_PUBLIC_SUPABASE_URL tanımlı değil.");
  }

  return createSupabaseClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
