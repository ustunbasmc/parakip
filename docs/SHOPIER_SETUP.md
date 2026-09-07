# Shopier Ödeme Entegrasyonu — Kurulum

## Önemli Sınırlama

**Shopier'da gerçek, otomatik yenilenen abonelik (recurring payment)
YOKTUR** — yalnızca tek seferlik ödeme desteklenir. Bu yüzden Parakip'te
İşletme aboneliği **manuel yenilemeli bir paket satışı** olarak
uygulanmıştır:

- Kullanıcı ödeme yaptığında erişim 30 gün (aylık) veya 365 gün (yıllık)
  boyunca aktif olur (`subscriptions.current_period_end`).
- Süre dolduğunda erişim **otomatik olarak kapanır** (`has_business_
  subscription()` fonksiyonu zaten `current_period_end > now()` kontrolü
  yapıyor — ek bir cron/otomasyon GEREKMEZ).
- Kullanıcı `/settings/plan` ekranına dönüp **tekrar ödeme yapmalıdır**.
  Otomatik kart çekimi YOKTUR. Bu, arayüzde açıkça belirtilir.

## Ortam Değişkenleri

`.env.example` dosyasına bakın: `SHOPIER_API_KEY`, `SHOPIER_API_SECRET`,
`SHOPIER_HOME_MONTHLY_PRICE_TRY`, `SHOPIER_HOME_YEARLY_PRICE_TRY`,
`SHOPIER_BUSINESS_MONTHLY_PRICE_TRY`, `SHOPIER_BUSINESS_YEARLY_PRICE_TRY`.

Güncel fiyatlar:
- **Ev Premium:** 99,00 TL/ay · 990,00 TL/yıl
- **İşletme Premium:** 249,00 TL/ay · 2.490,00 TL/yıl

Shopier Merchant Panel → Ayarlar → API bilgileri kısmından API Key ve
API Secret alınır. Shopier'da AYRICA bir "ürün" tanımlamaya gerek YOKTUR
— fiyat ve ürün adı her ödeme isteğinde doğrudan gönderilir.

## Nasıl Çalışır

1. Kullanıcı `/settings/plan` → Ev alanındaysa "Ev Premium satın al",
   İşletme alanındaysa "İşletme Premium satın al" → aylık/yıllık seçer.
   **Ev Premium yalnızca o alanın SAHİBİ tarafından satın alınabilir**
   (Premium kontrolü sahibe göre yapıldığı için — bkz. `has_home_
   premium`, migration 0052); diğer üyeler bu kartı görmez.
2. `POST /api/shopier/checkout` — oturum + yetki (Ev: sahip, İşletme:
   owner/admin) + alan tipi doğrulanır, Shopier'a gönderilecek imzalı
   bir form üretilir (`src/lib/shopier/client.ts`).
3. Form otomatik submit olur, kullanıcı Shopier'ın kendi ödeme sayfasına
   gider — **kart bilgisi Parakip'e hiç ulaşmaz**.
4. Ödeme tamamlanınca Shopier, tarayıcıyı `POST /api/shopier/callback`
   adresine yönlendirir.
5. Callback, **HMAC-SHA256 imzasını doğrular** (imza uyuşmuyorsa hiçbir
   veri yazılmaz — sahte çağrı koruması). İmza geçerliyse ve
   `status === "success"` ise, `subscriptions` tablosuna service_role
   ile satır yazılır/güncellenir.
6. Kullanıcı `/settings/plan?shopier_result=success` adresine
   yönlendirilir, sonuç mesajı gösterilir.

## Test Etme

Shopier test/sandbox modu sunmuyor — gerçek bir küçük tutarla (ör. 1 TL)
test ödemesi yapıp callback'in doğru çalıştığını doğrulamanız gerekir.
Sorun yaşarsanız Shopier panelindeki "İşlem Geçmişi" ile `subscriptions`
tablosundaki satırı karşılaştırın.

## Bilinen Sınırlamalar

- Otomatik yenileme yok (yukarıda açıklandı).
- Shopier'ın resmi bir Node.js SDK'sı olmadığından imzalama mantığı
  elle yazılmıştır (`src/lib/shopier/client.ts`) — algoritma birden
  fazla bağımsız kaynaktan doğrulanmış, üç ayrı senaryoyla (imza
  üretimi, round-trip doğrulama, UUID+ayraç çözümlemesi) test edilmiştir.
