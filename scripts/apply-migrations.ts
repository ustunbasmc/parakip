/**
 * Gerçek bir Supabase projesine tüm migration'ları sırayla uygular.
 * PLATFORMDAN BAĞIMSIZDIR — Windows/Mac/Linux fark etmeksizin çalışır,
 * bash/WSL veya ayrıca kurulmuş bir `psql` istemcisi GEREKTİRMEZ (yalnızca
 * Node.js + bu projenin bağımlılıkları yeterlidir; bağlantı için `pg`
 * npm paketi kullanılır).
 *
 * Kullanım (yeni bir migration eklendiğinde, ÖNERİLEN — HEDEFLİ):
 *   MIGRATION_FROM=0046 npx tsx scripts/apply-migrations.ts
 * (Windows PowerShell: $env:MIGRATION_FROM="0046"; npx tsx scripts/apply-migrations.ts)
 *
 * SUPABASE_DB_URL'i .env.local'e koyabilir veya doğrudan ortam değişkeni
 * olarak verebilirsiniz — bkz. docs/REAL_SUPABASE_SETUP.md. Almak için:
 * Supabase Dashboard'da projenizin ana sayfasındaki "Connect" butonuna
 * tıklayın, "Session pooler" sekmesindeki URI'yi kullanın.
 *
 * MIGRATION_FROM KULLANIRKEN ARTIK ATLANAN HER DOSYA AÇIKÇA LİSTELENİR —
 * bu, tam olarak 0044_spaces_sector.sql'in daha önce FARK EDİLMEDEN
 * atlanmasını önlemek için eklendi (bkz. proje raporu). Bu listeyi HER
 * ZAMAN gözden geçirin; içinde SİZCE HENÜZ uygulanmamış bir dosya varsa
 * MIGRATION_FROM değerinizi düzeltin.
 *
 * KENDİ KENDİNİ ONARAN (self-healing) GÜVENLİK AĞI: Bir dosya "...
 * already exists" türünde bir hatayla başarısız olursa (relation, column,
 * policy, view zaten varsa), script bunu bir UYARI olarak yazıp o dosyayı
 * atlar, ÇALIŞMAYI İPTAL ETMEZ. Bu, MIGRATION_FROM aralığınız yanlışlıkla
 * ZATEN uygulanmış bir dosyayı da içerirse sizi korur.
 *
 * ÖNEMLİ SINIR (dürüstçe belirtilmeli): Bu güvenlik ağı TABLO/SÜTUN/VIEW/
 * POLİTİKA türü migration'lar için güvenilirdir, ama FONKSİYONLARI
 * `create or replace` ile YENİDEN TANIMLAYAN eski migration'lar için
 * DEĞİLDİR — Postgres, farklı bir imzayla CREATE OR REPLACE yapıldığında
 * hata VERMEZ, sessizce YENİ BİR OVERLOAD ekler. Bu yüzden TÜM geçmişi
 * (0001'den itibaren) bir zaten-ileri-durumdaki veritabanında YENİDEN
 * ÇALIŞTIRMAK — özellikle imzası SONRADAN değiştirilmiş fonksiyonlar
 * (ör. update_debt) için — beklenmedik "function name ... is not unique"
 * hatalarına yol açabilir. Bu yüzden MIGRATION_FROM'suz TAM SIFIRDAN
 * YENİDEN ÇALIŞTIRMA henüz ZATEN İLERİDE olan bir veritabanında ÖNERİLMEZ
 * — bunun yerine her zaman YALNIZCA yeni eklenen dosya(lar) için HEDEFLİ
 * MIGRATION_FROM kullanın (yukarıdaki skip listesiyle doğrulayarak).
 */
import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";
import { loadEnvLocal } from "./load-env";

loadEnvLocal();

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = resolve(__dirname, "..", "supabase", "migrations");

/** Postgres'in "zaten var" hatalarının HEPSİ tutarlı biçimde bu ifadeyle biter. */
function isAlreadyAppliedError(message: string): boolean {
  return message.toLowerCase().includes("already exists");
}

async function main() {
  const connectionString = process.env.SUPABASE_DB_URL;

  if (!connectionString) {
    console.error("❌ SUPABASE_DB_URL ortam değişkeni tanımlı değil.");
    console.error(
      "   Supabase Dashboard -> proje ana sayfası -> 'Connect' -> 'Session pooler' sekmesinden alın."
    );
    process.exitCode = 1;
    return;
  }

  const migrationFrom = process.env.MIGRATION_FROM;
  const allFiles = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  let files = allFiles;

  if (migrationFrom) {
    const skipped = allFiles.filter((f) => f < migrationFrom);
    files = allFiles.filter((f) => f >= migrationFrom);

    console.log(`⚠️  MIGRATION_FROM=${migrationFrom} kullanılıyor — ${skipped.length} dosya ATLANACAK:`);
    if (skipped.length === 0) {
      console.log("   (atlanan dosya yok)");
    } else {
      for (const f of skipped) console.log(`   - ${f}`);
    }
    console.log(
      "   Bu dosyaların GERÇEKTEN uygulandığından emin değilseniz, MIGRATION_FROM'suz\n" +
        "   (yalnızca 'npx tsx scripts/apply-migrations.ts') çalıştırın — script artık\n" +
        "   zaten uygulanmış dosyaları kendisi algılayıp atlıyor, hiçbir gerçek risk yok."
    );
    console.log("");

    if (!allFiles.some((f) => f.startsWith(migrationFrom))) {
      console.log(
        `⚠️  UYARI: "${migrationFrom}" ön ekiyle BAŞLAYAN hiçbir dosya yok — muhtemelen bir yazım hatası var.`
      );
      console.log("");
    }
  }

  console.log(`Migration dizini: ${migrationsDir}`);
  console.log(`${files.length} dosya denenecek.`);
  console.log("");

  const client = new Client({ connectionString });

  try {
    await client.connect();
  } catch (err) {
    console.error("❌ Veritabanına bağlanılamadı:", (err as Error).message);
    console.error("   SUPABASE_DB_URL'in doğru olduğundan ve 'Session pooler'");
    console.error("   bağlantısını kullandığınızdan emin olun (Direct connection");
    console.error("   çoğu ev/ofis ağından IPv6 kısıtı nedeniyle bağlanamaz).");
    process.exitCode = 1;
    return;
  }

  const appliedNow: string[] = [];
  const alreadyApplied: string[] = [];

  try {
    for (const file of files) {
      const fullPath = join(migrationsDir, file);
      const sql = readFileSync(fullPath, "utf8");
      console.log(`=== ${file} ===`);
      try {
        await client.query(sql);
        console.log("✅ uygulandı");
        appliedNow.push(file);
      } catch (err) {
        const message = (err as Error).message;
        if (isAlreadyAppliedError(message)) {
          console.log(`⏭️  atlandı (zaten uygulanmış görünüyor: ${message})`);
          alreadyApplied.push(file);
        } else {
          console.error(`❌ HATA: ${message}`);
          console.error("");
          console.error(`${file} gerçek bir hatayla başarısız oldu (zaten var olma hatası DEĞİL).`);
          console.error(
            "Supabase Dashboard'dan (Table Editor / SQL Editor) veritabanı durumunu kontrol edin."
          );
          process.exitCode = 1;
          return;
        }
      }
      console.log("");
    }

    console.log(
      `TAMAMLANDI — ${appliedNow.length} dosya bu çalıştırmada uygulandı, ${alreadyApplied.length} dosya zaten uygulanmıştı (atlandı), toplam ${files.length} dosya denendi.`
    );
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("❌ Beklenmeyen hata:", err);
  process.exitCode = 1;
});
