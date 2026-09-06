/**
 * Standalone script'ler (bu klasördeki .ts dosyaları) `npx tsx` ile
 * doğrudan çalıştırılır — Next.js'in kendi geliştirme/build sürecinin
 * `.env.local`'i OTOMATİK okuma davranışına BURADA GÜVENİLMEZ, çünkü
 * `tsx` Next.js çatısının dışında, bağımsız bir Node süreci başlatır.
 *
 * Bunun yerine Node'un kendi yerleşik `process.loadEnvFile()` API'si
 * kullanılır (Node 20.12+'da stabil, ek bir "dotenv" paket bağımlılığı
 * GEREKTİRMEZ). Zaten `export` ile shell'de ayarlanmış değişkenler
 * ÖNCELİKLİDİR — `.env.local`'deki değerler yalnızca process.env'de
 * HENÜZ TANIMLI OLMAYAN değişkenleri doldurur, var olanı EZMEZ (Node'un
 * kendi davranışı, test edilip doğrulanmıştır).
 *
 * GÜVENLİK: Bu modül hiçbir zaman değişken DEĞERİNİ konsola yazdırmaz —
 * yalnızca "yüklendi/yüklenemedi" bilgisini, dosya yolunu belirterek verir.
 */
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "..", ".env.local");

export function loadEnvLocal(): void {
  if (existsSync(envPath)) {
    process.loadEnvFile(envPath);
    console.log(`ℹ️  .env.local yüklendi (${envPath}).`);
  } else {
    console.log(
      `ℹ️  .env.local bulunamadı (${envPath}) — ortam değişkenlerinin ` +
        `doğrudan shell'de export edilmiş olduğu varsayılıyor.`
    );
  }
}
