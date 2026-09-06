# Gerçek Supabase Projesi Kurulumu ve Doğrulama

Bu belge, Parakip'i **gerçek** bir Supabase projesine bağlamak ve tüm
akışları doğrulamak için adım adım kılavuzdur.

> **Önemli:** Bu adımların TAMAMI, geliştirme ortamında (bu sandbox'ta
> DEĞİL) çalıştırılmalıdır. Bu sandbox'ın ağ erişim izin listesi
> `supabase.co`/`supabase.com` içermiyor — buradan hiçbir Supabase API
> çağrısı yapılamaz. Aşağıdaki script'ler bu sandbox'ta **yazıldı ve
> mantıksal olarak doğrulandı** (tip kontrolü, lint), ama gerçek bir
> projeye karşı **çalıştırılamadı**.

## 1. Supabase Projesi Oluşturma (manuel, dashboard)

1. [supabase.com](https://supabase.com) üzerinde bir hesap açın (yoksa).
2. "New Project" ile yeni bir proje oluşturun. Bölge olarak Türkiye'ye en
   yakın bölgeyi seçin (KVKK açısından veri bölgesi kararı — bkz. proje
   anayasası madde 12; bu karar henüz resmen onaylanmadı, bu adımda
   yalnızca teknik kurulum yapılıyor).
3. Proje oluşunca **Project Settings -> API** sayfasından şunları alın:
   - `Project URL` -> `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` anahtarı -> `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` anahtarı -> `SUPABASE_SERVICE_ROLE_KEY` (yalnızca
     sunucu tarafında kullanılacak, ASLA istemciye/git'e gönderilmez)
4. Veritabanı bağlantı dizesi için dashboard ana sayfasındaki **"Connect"**
   butonuna tıklayın (Project Settings -> Database'de DEĞİL, bu buton
   genellikle projenin ana sayfasında/üst kısmında). Açılan pencerede üç
   sekme görürsünüz:
   - **Direct connection**: varsayılan olarak yalnızca IPv6 — çoğu ev/ofis
     ağı (IPv4) buna bağlanamaz, "connection refused" alırsınız.
   - **Session pooler**: IPv4 üzerinden çalışır, migration script'imiz
     (sıralı `psql -f`) için ÖNERİLEN seçenek budur.
   - **Transaction pooler**: bazı oturum-seviyeli özellikleri desteklemez,
     migration'lar için önerilmez.

   **Session pooler** sekmesindeki URI'yi kopyalayıp `[YOUR-PASSWORD]`
   kısmını gerçek veritabanı şifrenizle değiştirin (unuttuysanız Project
   Settings -> Database -> Reset database password) -> `SUPABASE_DB_URL`.

Bu dört değeri `.env.local` dosyanıza yazın (`.env.local.example`'ı kopyalayıp
doldurun).

## 2. Migration'ları Uygulama

`.env.local`'e `SUPABASE_DB_URL`'i yazdıysanız (yukarıdaki adım 4), doğrudan:

```bash
npx tsx scripts/apply-migrations.ts
```

Bu, **platformdan bağımsızdır** (Windows/Mac/Linux) — `bash`, WSL veya
ayrıca kurulmuş bir `psql` istemcisi GEREKTİRMEZ, yalnızca Node.js
yeterlidir (bağlantı `pg` npm paketiyle kurulur).

`.env.local` kullanmak istemiyorsanız, değişkeni doğrudan verebilirsiniz:

```bash
# macOS/Linux
SUPABASE_DB_URL="postgresql://postgres.xxxx:[SIFRE]@aws-0-xx-xxxx.pooler.supabase.com:5432/postgres" npx tsx scripts/apply-migrations.ts

# Windows PowerShell
$env:SUPABASE_DB_URL="postgresql://postgres.xxxx:[SIFRE]@aws-0-xx-xxxx.pooler.supabase.com:5432/postgres"
npx tsx scripts/apply-migrations.ts
```

Bu, `supabase/migrations/` altındaki 40 dosyayı sırayla uygular. Daha önce
38 dosyayı uygulamış olsanız bile bu script'i TEKRAR çalıştırmanız
sorunsuzdur — script yalnızca `supabase/migrations/` klasöründeki dosyaları
sırayla uygular; daha önce uygulanmamış (0039, 0040) yeni dosyalar bu
sefer eklenmiş olacaktır. (Uyarı: script kendi başına "hangi migration
zaten uygulandı" takibi yapmaz — script'i TAMAMI uygulanmış bir
veritabanında BAŞTAN çalıştırırsanız ilk dosyalarda "already exists"
hatası alırsınız; bu durumda yalnızca YENİ dosyaları elle çalıştırın veya
Supabase Dashboard'dan hangi migration'ların uygulandığını kontrol edin.)

> **Alternatif (yalnızca macOS/Linux/WSL, `psql` kuruluysa):**
> `scripts/apply-migrations.sh` da mevcuttur ve aynı işi `psql` üzerinden
> yapar. Windows'ta (WSL olmadan) çalışmaz — `npx tsx
> scripts/apply-migrations.ts` kullanın.
Hata olursa script durur; hangi dosyada durduğunu okuyup düzeltin.

## 3. Bağlantı Kontrolü

`.env.local` doldurulduysa doğrudan:

```bash
npx tsx scripts/check-supabase-connection.ts
```

Üç kontrolün de (auth uç noktası, RLS altında `profiles`, herkese açık
`market_prices_cache`) ✅ vermesi gerekir.

> **"Could not find the table 'public.profiles' in the schema cache"
> hatası alırsanız:** Bu, migration'ların HENÜZ UYGULANMADIĞI anlamına
> gelir — önce Adım 2'yi (migration'ları uygulama) tamamlayın. Migration'ları
> uyguladıktan SONRA bu hata hâlâ görünüyorsa, PostgREST'in şema önbelleği
> henüz yenilenmemiş olabilir (birkaç saniye içinde otomatik yenilenir);
> hemen zorlamak isterseniz Supabase Dashboard -> Database -> API ->
> "Reload schema" düğmesine basın.

## 4. Google OAuth Altyapısını Etkinleştirme (isteğe bağlı ama istenmişti)

Kod tarafı (`signInWithOAuth`, `/auth/callback`) zaten hazır. Çalışması için:

1. [Google Cloud Console](https://console.cloud.google.com) -> yeni bir
   OAuth 2.0 Client ID oluşturun (Web application).
2. Authorized redirect URI olarak Supabase'in size verdiği callback URL'ini
   ekleyin (Supabase Dashboard -> Authentication -> Providers -> Google
   sayfasında gösterilir).
3. Client ID/Secret'i Supabase Dashboard -> Authentication -> Providers ->
   Google'a girip etkinleştirin.
4. Uygulamanızda `/sign-in` veya `/sign-up`'tan "Google ile devam et"i
   deneyin.

## 5. Otomatik Uçtan Uca Doğrulama

`.env.local` doldurulduysa doğrudan:

```bash
npx tsx scripts/verify-real-supabase.ts
```

Gerçek bir e-postayla (onay/sıfırlama bağlantısına gerçekten tıklamak için):

```bash
# macOS/Linux
TEST_EMAIL_A="sizin+testA@gmail.com" TEST_EMAIL_B="sizin+testB@gmail.com" npx tsx scripts/verify-real-supabase.ts

# Windows PowerShell
$env:TEST_EMAIL_A="sizin+testA@gmail.com"; $env:TEST_EMAIL_B="sizin+testB@gmail.com"
npx tsx scripts/verify-real-supabase.ts
```

Bu script otomatik olarak şunları test eder: kayıt, hatalı şifre, şifre
sıfırlama isteği (API çağrısı), tema tercihi kaydetme/okuma, Ev alanı
oluşturma, İşletme alanı oluşturma, ikinci Ev alanı reddi, ve iki farklı
kullanıcı arasında RLS izolasyonu.

**Not:** Eğer Supabase projenizde e-posta onayı AÇIKSA (varsayılan), script
kayıt sonrası oturum bulamayacak ve 4-7 arası testleri atlayacaktır. Bu
durumda script'in çıktısındaki test e-postasına gidip onay bağlantısına
tıkladıktan sonra script'i tekrar çalıştırın.

## 6. Script'in Otomatik Test Edemediği, MUTLAKA Manuel Doğrulanması Gerekenler

| Adım | Nasıl doğrulanır |
|---|---|
| E-posta doğrulama bağlantısı | `/sign-up` ile gerçek bir e-postayla kaydolun, gelen bağlantıya tıklayın, ardından `/sign-in` ile giriş yapabildiğinizi doğrulayın |
| Şifre sıfırlama bağlantısı | `/reset-password`'den istek gönderin, gelen bağlantıya tıklayın, `/update-password` ekranının açıldığını ve yeni şifreyle giriş yapabildiğinizi doğrulayın |
| Google OAuth | Yukarıdaki adım 4 sonrası gerçek bir Google hesabıyla deneyin |
| Yetkisiz rota erişimi (gerçek dağıtımda) | Uygulamayı Vercel'e (veya başka bir sunucuya) deploy ettikten sonra, oturum açmadan `/home`, `/onboarding/*`, `/settings/theme`'e gitmeyi deneyip `/welcome`'a yönlendirildiğinizi doğrulayın — bu Adım 13'te yerel `next dev` sunucusuna karşı `curl` ile zaten doğrulandı, gerçek dağıtımda tekrarı önerilir |
| Tema gece/gündüz/sistem geçişi | Tarayıcıda `/settings/theme`'den üç seçeneği de deneyip anında (sayfa yenilenmeden) değiştiğini, sekmeyi kapatıp yeniden açtığınızda tercihin korunduğunu gözle doğrulayın |

## 7. Bu Doğrulamalar Tamamlanmadan Yapılmaması Gerekenler

Kullanıcının talimatı gereği: **gerçek Supabase bağlantısı yukarıdaki
adımlarla doğrulanmadan dashboard veya yeni finans ekranlarına
geçilmeyecektir.**

## 8. Sorun Giderme

| Karşılaşılan durum | Anlamı / Çözümü |
|---|---|
| `bash : The term 'bash' is not recognized...` | Windows'ta `apply-migrations.sh` çalışmaz (bash yok). Bunun yerine **`npx tsx scripts/apply-migrations.ts`** kullanın — platformdan bağımsızdır, ek kurulum gerektirmez. |
| `Could not find the table 'public.profiles' in the schema cache` | Migration'lar henüz uygulanmadı. Önce Adım 2'yi tamamlayın. Uyguladıktan sonra da devam ediyorsa Dashboard -> Database -> API -> "Reload schema". |
| `column "sector" of relation "spaces" does not exist` (İşletme oluştururken) | `0044_spaces_sector.sql` uygulanmamış demektir. `MIGRATION_FROM=0046 npx tsx scripts/apply-migrations.ts` çalıştırın — bu, sütunu idempotent olarak ekler (0044 uygulanmış olsa da olmasa da güvenlidir). Ardından, iyi bir alışkanlık olarak Dashboard -> Database -> API -> "Reload schema" düğmesine de basın (bu spesifik hata için PostgREST önbelleği ZORUNLU değildi çünkü sorun bir RPC fonksiyonunun İÇİNDEYDİ, ama herhangi bir şema değişikliğinden sonra genel bir önlem olarak önerilir). |
| `connect ETIMEDOUT` / `connection refused` (migration uygularken) | `SUPABASE_DB_URL` muhtemelen "Direct connection" (IPv6). "Connect" penceresindeki **"Session pooler"** sekmesini kullanın. |
| `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)...` çökmesi | Node'un yeni sürümlerinde (özellikle Windows) bilinen bir libuv hatasıydı — script'ler artık `process.exit()` yerine `process.exitCode` kullanıyor, bu sorun giderildi. Hâlâ görüyorsanız script dosyalarınızın bu son sürümle güncel olduğundan emin olun. |
