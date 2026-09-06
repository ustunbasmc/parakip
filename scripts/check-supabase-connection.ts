/**
 * Gerçek bir Supabase projesine bağlantıyı doğrular. Bu sandbox'ın ağ
 * erişimi supabase.co'ya KAPALI olduğu için bu script BURADA çalıştırılamaz
 * — kendi makinenizde veya CI'da çalıştırın. İki şekilde de çalışır:
 *
 *   1) .env.local dosyanız varsa (proje köküne .env.local.example'dan
 *      kopyalayıp doldurduysanız), doğrudan çalıştırmanız yeterli:
 *        npx tsx scripts/check-supabase-connection.ts
 *
 *   2) .env.local yoksa/kullanmak istemiyorsanız, değişkenleri shell'de
 *      export edin (bunlar .env.local'dekinden ÖNCELİKLİDİR):
 *        export NEXT_PUBLIC_SUPABASE_URL=...
 *        export NEXT_PUBLIC_SUPABASE_ANON_KEY=...
 *        npx tsx scripts/check-supabase-connection.ts
 *
 * NOT: Next.js'in kendi geliştirme sunucusu .env.local'i otomatik okur,
 * ama bu script Next.js DIŞINDA, `tsx` ile bağımsız bir Node süreci
 * olarak çalıştığı için bu davranışa güvenilemez — bkz. load-env.ts.
 *
 * Başarılı bir çalışma şunları doğrular:
 *  1. URL/anon key formatı geçerli ve proje gerçekten yanıt veriyor.
 *  2. auth şeması erişilebilir (getSession, oturum olmasa bile hata vermez).
 *  3. profiles tablosu (anon/authenticated olmadan, yani RLS altında)
 *     sorgulanabiliyor ve RLS nedeniyle BOŞ döndürüyor (hata değil) —
 *     bu, RLS'in etkin ve GRANT'lerin doğru olduğunun bir işaretidir.
 *
 * GÜVENLİK: Bu script anon key'in KENDİSİNİ hiçbir zaman konsola yazdırmaz
 * (yalnızca proje URL'i, ki bu zaten gizli değildir).
 *
 * NOT (Windows/Node 24 uyumluluğu): Bu script `process.exit()` YERİNE
 * `process.exitCode` kullanır ve fonksiyonlardan `return` ile çıkar —
 * Node'un yeni sürümlerinde (özellikle Windows'ta) bir ağ isteğinden hemen
 * sonra `process.exit()` çağırmak "Assertion failed: !(handle->flags &
 * UV_HANDLE_CLOSING)" gibi bir libuv çökmesine yol açabiliyor.
 */
import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal } from "./load-env";

loadEnvLocal();

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    console.error("❌ NEXT_PUBLIC_SUPABASE_URL ve/veya NEXT_PUBLIC_SUPABASE_ANON_KEY tanımlı değil.");
    process.exitCode = 1;
    return;
  }

  console.log(`Proje URL: ${url}`);
  console.log("");

  const supabase = createClient(url, anonKey);

  console.log("1) Oturum uç noktası kontrol ediliyor...");
  const { error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    console.error(`❌ auth.getSession() hata döndü: ${sessionError.message}`);
    process.exitCode = 1;
    return;
  }
  console.log("✅ Auth uç noktasına erişildi (oturum yok, bu normal).");

  console.log("");
  console.log("2) profiles tablosu RLS altında sorgulanıyor (oturumsuz)...");
  const { data, error: tableError } = await supabase.from("profiles").select("user_id").limit(1);
  if (tableError) {
    console.error(`❌ profiles sorgusu hata döndü: ${tableError.message}`);
    console.error("   Bu, migration'ların henüz uygulanmadığı veya GRANT'lerin eksik");
    console.error("   olduğu anlamına gelebilir (bkz. 0038_ensure_authenticated_grants.sql).");
    console.error("   -> Önce 'npx tsx scripts/apply-migrations.ts' çalıştırdığınızdan emin olun.");
    process.exitCode = 1;
    return;
  }
  if (data && data.length > 0) {
    console.error("⚠️  profiles sorgusu OTURUMSUZ olarak veri döndürdü — RLS BEKLENDİĞİ GİBİ ÇALIŞMIYOR OLABİLİR.");
    process.exitCode = 1;
    return;
  }
  console.log("✅ profiles sorgusu boş döndü (RLS beklendiği gibi engelliyor).");

  console.log("");
  console.log("3) market_prices_cache (herkese açık okuma) sorgulanıyor...");
  const { error: pricesError } = await supabase.from("market_prices_cache").select("id").limit(1);
  if (pricesError) {
    console.error(`❌ market_prices_cache sorgusu hata döndü: ${pricesError.message}`);
    process.exitCode = 1;
    return;
  }
  console.log("✅ market_prices_cache erişilebilir (hata yok — 0 satır dönmesi normal, henüz veri yok).");

  console.log("");
  console.log("TÜM BAĞLANTI KONTROLLERİ BAŞARILI.");
}

main().catch((err) => {
  console.error("❌ Beklenmeyen hata:", err);
  process.exitCode = 1;
});
