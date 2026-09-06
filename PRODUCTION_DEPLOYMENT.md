# Production'a Güvenli Geçiş Rehberi

Bu belge yalnızca **yapı ve süreç** hazırlığıdır — gerçek bir domain,
ödeme sağlayıcısı, gerçek Supabase anahtarı veya production sırrı
içermez, otomatik deploy tetiklemez.

## 1. Ortam Ayrımı (Development / Preview / Production)

Vercel Dashboard → Project → Settings → Environment Variables →
her değişken **Development / Preview / Production** için AYRI AYRI
tanımlanabilir ve tanımlanmalıdır:

| Ortam       | Supabase projesi             | `NEXT_PUBLIC_SITE_URL`            |
|-------------|-------------------------------|-------------------------------------|
| Development | Yerel/geliştirme Supabase     | `http://localhost:3000`             |
| Preview     | Ayrı bir staging Supabase     | Vercel'in verdiği önizleme URL'i    |
| Production  | Production Supabase projesi   | Gerçek domain (ör. `https://parakip.app`) |

**Production Supabase projesini Development/Preview ile ASLA paylaşma**
— aksi halde test verisi gerçek kullanıcı verisiyle karışır.

## 2. Vercel Environment Variables — Tam Liste

Aşağıdaki tüm değişkenler Vercel'de tanımlanmalıdır (bkz. `.env.example`).
"Kapsam" sütunu, değişkenin hangi Vercel ortamlarında (Development/
Preview/Production) tanımlı olması gerektiğini gösterir.

| Değişken | Client'a açık mı? | Kapsam | Açıklama |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Evet | Tümü | İlgili ortamın Supabase proje URL'i |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Evet | Tümü | anon anahtar — RLS ile korunur, tek başına hassas değil |
| `NEXT_PUBLIC_SITE_URL` | Evet | Tümü (ortama göre farklı domain) | SEO/OG/canonical/sitemap için |
| `SUPABASE_SERVICE_ROLE_KEY` | **Hayır** | Yalnızca Production (ve gerekirse Preview) | RLS'i TAMAMEN ATLAR — yalnızca `/api/cron/*` gibi sunucu kodunda |
| `SUPABASE_DB_URL` | **Hayır** | Yalnızca gerekiyorsa (ör. elle migration çalıştırma) | Doğrudan Postgres bağlantısı — asla client'a sızdırılmaz |
| `CRON_SECRET` | **Hayır** | Yalnızca Production (ve Preview'de test ediliyorsa) | `/api/cron/run-notifications` için paylaşılan sır |

`NEXT_PUBLIC_*` ÖNEKİ OLMAYAN hiçbir değişken Vercel'in "Preview" veya
"Development" için farklı (daha zayıf) bir değerle bile istemciye
**asla** enjekte edilmez — Next.js yalnızca derleme zamanında
`NEXT_PUBLIC_*` önekli değişkenleri tarayıcı paketine gömer; diğerleri
zaten yalnızca sunucu runtime'ında okunabilir. Bu proje ayrıca
`src/lib/supabase/service.ts` dosyasında `server-only` paketiyle bu
ayrımı **derleme zamanında** da zorunlu kılar (yanlışlıkla bir client
component'e import edilirse build HATA verir).

## 3. Migration Uygulama Adımları (Production)

1. **Önce yedek al.** Supabase Dashboard → Database → Backups (veya
   `pg_dump`) ile production veritabanının tam bir yedeğini al.
   **Bu adımı asla atlama — migration'lar geri alınamaz.**
2. Migration'ları **sırayla, numara sırasına göre** uygula
   (`0001` → mevcut en yüksek numara). Hiçbiri atlanmamalı.
3. **`0055_archive_account_and_cancel_transactions.sql` özel not:** bu
   migration yeni bir fonksiyon (`archive_account_and_cancel_
   transactions`) ekler ve mevcut hiçbir tabloyu/politikayı değiştirmez
   — production'da diğer migration'larla AYNI sırada, hedefe özel bir
   ek adım GEREKTİRMEDEN uygulanabilir. Yalnızca uygulandıktan sonra
   `select proname from pg_proc where proname = 'archive_account_and_cancel_transactions';`
   ile fonksiyonun gerçekten oluştuğunu doğrulamanız önerilir.
4. Migration'lar idempotent DEĞİLDİR (`create table`, `create function`
   gibi kesin komutlar kullanır) — zaten uygulanmış bir migration'ı
   tekrar çalıştırmak HATA verir. Bu BİLİNÇLİDİR: "sessizce hiçbir şey
   yapmadı" yanılsamasını önler. Supabase CLI (`supabase db push`) migration
   geçmişini otomatik takip eder; elle SQL Editor'den çalıştırıyorsan
   hangi migration'ların ZATEN uygulandığını mutlaka kontrol et.
5. Migration sonrası basit bir sağlık kontrolü yap (ör. tablo sayısını
   veya belirli bir fonksiyonun varlığını sorgula).

## 4. Zamanlayıcı (Cron) Kurulumu — Production

`/api/cron/run-notifications` endpoint'i **`CRON_SECRET` olmadan asla
çalışmaz** (401 döner) — bu davranış kodda zaten sabittir, production'da
ayrıca bir ayar gerektirmez. Aşağıdaki İKİ yöntemden biri seçilmelidir:

**A) Supabase pg_cron (varsa tercih edilir):** Production Supabase
projesinde pg_cron eklentisi etkinse, `0054` migration'ı bunu OTOMATİK
zamanlar (`run_scheduled_notifications()` günde bir kez, UTC 06:00).
Bu durumda `/api/cron/*` endpoint'ine hiç ihtiyaç YOKTUR.

**B) Harici zamanlayıcı (pg_cron yoksa):** Vercel Cron Jobs (proje
köküne bir `vercel.json` ile `crons` tanımı eklenerek) veya GitHub
Actions/cron-job.org gibi bir alternatif, günde bir kez şu isteği
göndermelidir:

```
POST https://<production-domain>/api/cron/run-notifications
Authorization: Bearer <CRON_SECRET>
```

Vercel Cron kullanılacaksa, Vercel'in kendi tetiklediği cron istekleri
`CRON_SECRET`'i OTOMATİK EKLEMEZ — `vercel.json`'daki cron tanımı
yalnızca URL'yi zamanlar, kimlik doğrulamayı SİZ (bir Vercel Cron
Secret veya aynı `CRON_SECRET` değerini `Authorization` başlığına
Vercel'in "Cron Job" ayarlarından ekleyerek) sağlamalısınız — aksi
halde endpoint 401 ile isteği reddeder (bu KORUMA bilinçlidir).

## 5. SEO / Canonical / Open Graph / robots-sitemap Durumu

* `src/app/robots.ts` ve `src/app/sitemap.ts` eklendi — yalnızca
  GERÇEKTEN herkese açık olan `/` (tanıtım sayfası) taranabilir/
  listelenir olarak işaretlendi; oturum gerektiren tüm rotalar
  (`/home`, `/settings`, `/api` vb.) açıkça `disallow` edildi. Var
  olmayan/erişilemeyen bir sayfa için sahte link EKLENMEDİ.
* `NEXT_PUBLIC_SITE_URL` hem `robots.ts`/`sitemap.ts` hem de
  `layout.tsx`'teki `metadataBase` ve `/` sayfasının Open Graph/
  canonical etiketlerinde kullanılır — production'da GERÇEK domain'e
  ayarlanmadan bu URL'ler `localhost:3000`'e düşer (fallback), bu
  yüzden production'da BU DEĞİŞKENİ AYARLAMAK ZORUNLUDUR.

## 6. Build/Deploy

* `package.json`'daki `build` komutu standart `next build`'dir — Vercel
  bunu otomatik algılar, ek bir yapılandırma GEREKMEZ.
* `next.config.ts` varsayılan/minimal durumda — production için ek bir
  ayar zorunlu değildir.
* **Otomatik production deploy KURULMADI.** Önerilen akış: her push
  önce bir Vercel **Preview** deploy'u oluşturur (varsayılan Vercel
  davranışı); Preview'de manuel doğrulama yapıldıktan SONRA production'a
  geçiş **elle** (Vercel Dashboard → "Promote to Production" veya
  `main` branch'e merge, projenin Git entegrasyon ayarına göre)
  yapılmalıdır. Bu belge hiçbir CI/CD dosyası veya otomatik production
  deploy tetikleyicisi EKLEMEMİŞTİR.

## 7. Hata ve Başarısız İşlem Durumları

* Bu proje hiçbir yerde sahte "başarılı" mesajı göstermez — bir RPC/
  Supabase çağrısı hata dönerse kullanıcıya Türkçe, anlaşılır bir hata
  mesajı gösterilir (`ErrorBanner` bileşeni ile).
* İleride bir ödeme sağlayıcısı eklendiğinde, başarısız ödeme durumu
  AYNI ilkeyle ele alınmalı: dürüst bir "ödeme başarısız, tekrar dene"
  mesajı, asla sahte bir "abonelik aktif" durumu YAZILMAMALI.

## 8. Deploy Öncesi Kontrol Listesi

- [ ] Production Supabase projesi ayrı ve production'a özel
- [ ] Tüm migration'lar (0055 dahil) sırayla uygulandı, ÖNCE yedek alındı
- [ ] `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_DB_URL` / `CRON_SECRET`
      yalnızca sunucu ortam değişkeni, hiçbir yerde `NEXT_PUBLIC_*` değil
- [ ] `NEXT_PUBLIC_SITE_URL` gerçek production domain'ine ayarlı
- [ ] pg_cron VEYA Vercel Cron/harici zamanlayıcı kurulumu doğrulandı,
      `CRON_SECRET` olmadan `/api/cron/run-notifications`'ın 401
      döndüğü test edildi
- [ ] `robots.txt`/`sitemap.xml` gerçek domain ile doğru içerik üretiyor
- [ ] `.env.local` ve gerçek anahtarlar hiçbir zip/repo paylaşımına
      dahil edilmedi
- [ ] İlk deploy bir Preview ortamında doğrulandı, production'a geçiş
      ELLE onaylandı

Bu liste tamamlanmadan production deploy'u **yapılmamalıdır**.
