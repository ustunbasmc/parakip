# Parakip e-posta kurulumu (Resend)

Parakip iki tür e-posta gönderir:

| Tür | Örnekler | Kim gönderir |
|---|---|---|
| **Uygulama e-postaları** | Destek yanıtı, alan daveti, ödeme onayı/reddi, ekip bildirimi | Uygulama → Resend API (`RESEND_API_KEY`) |
| **Hesap e-postaları** | Kayıt onayı, şifre sıfırlama, e-posta değişikliği | Supabase Auth → SMTP (Resend) |

> Supabase'in yerleşik e-posta servisi yalnızca proje ekibinin adreslerine ve saatte birkaç e-posta gönderir; **gerçek kullanıcıların kayıt onayı e-postası almaması için tipik neden budur.** Aşağıdaki 4. adım bunu çözer.

Tüm adımlar yaklaşık 20–30 dakika sürer. DNS kayıtlarının yayılması birkaç dakikadan birkaç saate kadar sürebilir.

---

## 1. Resend hesabı ve alan adı

1. <https://resend.com> adresinde hesap aç.
2. **Domains → Add Domain**: `parakip.com` yaz, bölge olarak **Ireland (eu-west-1)** seç.
3. Resend sana eklemen gereken DNS kayıtlarını gösterir (genelde 3–4 kayıt):
   - `resend._domainkey` → **TXT** (DKIM)
   - `send` → **MX** (`feedback-smtp.eu-west-1.amazonses.com`, öncelik 10)
   - `send` → **TXT** (`v=spf1 include:amazonses.com ~all`)
   - İsteğe bağlı: `_dmarc` → **TXT** (`v=DMARC1; p=none;`)

   Bu kayıtlar yalnızca `send.` alt alanını ve DKIM kaydını kullanır; `parakip.com`'un mevcut e-posta (MX) ayarlarını **bozmaz**.

## 2. DNS kayıtlarını ekle (Güzel Hosting)

`parakip.com`'un DNS'i Güzel Hosting'de yönetiliyor.

1. Güzel Hosting müşteri paneli → alan adı → **DNS Yönetimi**.
2. Resend'in gösterdiği her kaydı **birebir** ekle (Tür, Ad/Host, Değer, Öncelik).
   - Panel alan adını otomatik ekliyorsa Ad alanına yalnızca `send` / `resend._domainkey` yaz, sonuna `.parakip.com` ekleme.
3. Resend'de **Verify DNS Records**'a bas. Tüm kayıtlar **Verified** olana kadar bekle.

## 3. API anahtarı ve Vercel ortam değişkenleri

1. Resend → **API Keys → Create API Key**: ad `parakip-production`, izin **Sending access**, alan adı `parakip.com`.
2. Anahtarı kopyala (yalnızca bir kez gösterilir, kimseyle paylaşma).
3. Vercel → proje → **Settings → Environment Variables** (Production), şunları ekle:

| Değişken | Değer |
|---|---|
| `RESEND_API_KEY` | Resend'den aldığın anahtar |
| `SUPPORT_EMAIL_FROM` | `Parakip <bildirim@parakip.com>` |
| `SUPPORT_EMAIL` | Yeni destek taleplerinin geleceği senin adresin |
| `NEXT_PUBLIC_SITE_URL` | `https://www.parakip.com` (e-postalardaki bağlantılar için; zaten tanımlıysa dokunma) |

4. **Deployments → son production dağıtımı → Redeploy** (ortam değişkenleri ancak yeni dağıtımda devreye girer).
5. Doğrula: **Admin → Sistem durumu → "Kendime test e-postası gönder"**.

## 4. Supabase: kayıt onayı ve şifre e-postaları (SMTP)

Supabase Dashboard → proje → **Authentication**:

### a) SMTP Settings → Enable Custom SMTP

| Alan | Değer |
|---|---|
| Sender email | `hesap@parakip.com` |
| Sender name | `Parakip` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | Resend API anahtarı (3. adımdaki, ya da ayrı bir anahtar) |

### b) Rate Limits

Özel SMTP'den sonra **Rate limit for sending emails** değerini ihtiyaca göre artır (örn. saatte 100).

### c) URL Configuration

- **Site URL:** `https://www.parakip.com`
- **Redirect URLs:** `https://www.parakip.com/**` (ve Preview için gerekiyorsa `https://*-mobil-sus.vercel.app/**`)

### d) Email Templates

Her şablon için **Subject** alanını ve **Message body (HTML)** alanını doldur. HTML'leri bu depodaki dosyalardan kopyala:

| Supabase şablonu | Konu | Dosya |
|---|---|---|
| Confirm signup | `Parakip hesabını onayla` | `docs/email-templates/confirm-signup.html` |
| Reset Password | `Parakip şifre sıfırlama` | `docs/email-templates/reset-password.html` |
| Change Email Address | `Parakip e-posta değişikliğini onayla` | `docs/email-templates/change-email.html` |

Şablonlardaki `{{ .ConfirmationURL }}` ve `{{ .NewEmail }}` alanlarını değiştirme; Supabase bunları doldurur.

Doğrula: yeni bir e-posta adresiyle kayıt ol → onay e-postası gelmeli (gelmezse spam klasörüne bak).

---

## Sorun giderme

| Belirti | Olası neden |
|---|---|
| Test e-postası: "alan adı doğrulanmamış" | Resend'de DNS kayıtları henüz Verified değil |
| Test e-postası: "API anahtarı geçersiz" | `RESEND_API_KEY` yanlış kopyalanmış ya da redeploy yapılmamış |
| Kayıt onayı hiç gelmiyor | Supabase'de Custom SMTP açık değil (4a) |
| E-postalar spam'e düşüyor | DMARC kaydı yok; DNS yayılımı sürüyor; birkaç gün sonra düzelir |
| E-postadaki bağlantı yanlış adrese gidiyor | `NEXT_PUBLIC_SITE_URL` veya Supabase Site URL `https://www.parakip.com` değil |

Uygulama e-postaları gönderilemezse hiçbir işlem başarısız olmaz (destek talebi, davet, ödeme onayı kaydedilir); yalnızca e-posta gitmez. Davetler her zaman bağlantı paylaşarak da iletilebilir.
