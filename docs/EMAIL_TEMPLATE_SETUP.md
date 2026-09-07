# E-posta Doğrulama Şablonunu Supabase'e Kurma

Bu belge, `docs/supabase-confirmation-email.html` dosyasının Supabase
Dashboard'a nasıl yapıştırılacağını anlatır. **Bu adımı Claude
uygulamamıştır** — Supabase Dashboard'a doğrudan erişim gerektirir,
bu yüzden elle yapılmalıdır.

## Adımlar

1. Supabase Dashboard → **production projeniz** → **Authentication →
   Email Templates**
2. Sol/üst listeden **"Confirm signup"** şablonunu seçin
3. Editördeki mevcut HTML içeriğinin **tamamını silin**
4. `docs/supabase-confirmation-email.html` dosyasının **tüm içeriğini**
   kopyalayıp oraya yapıştırın
5. **Save** deyin

## Değişkenler

Şablon, Supabase'in kendi sağladığı `{{ .ConfirmationURL }}`
değişkenini kullanır — bu, Supabase tarafından gönderim anında GERÇEK
doğrulama bağlantısıyla otomatik doldurulur. Şablonda başka hiçbir
gizli/kullanıcıya özel veri **YAZILMAMIŞTIR**.

## Test Etme

Kaydı Preview veya Production ortamında yeni bir e-posta ile deneyip
gelen e-postanın:
- Parakip marka başlığını ve sloganını gösterdiğini
- Büyük, tıklanabilir "E-posta adresimi doğrula" butonunun çalıştığını
- Mobil e-posta istemcisinde (ör. Gmail uygulaması) bozulmadan
  göründüğünü

kontrol edin.

## Notlar

- Şablon saf HTML+inline CSS'tir (e-posta istemcileri genelde harici
  CSS/JS desteklemez) — bu yüzden Tailwind/harici stil dosyası
  KULLANILMAMIŞTIR.
- Alt bilgideki "Destek", "Gizlilik Politikası" ve "Kullanım Koşulları"
  bağlantıları şu an `#` (placeholder) — gerçek sayfalar
  oluşturulduğunda bu `href` değerleri güncellenmelidir.
- Diğer Supabase e-posta şablonları (şifre sıfırlama, e-posta
  değişikliği vb.) bu turda **GÜNCELLENMEMİŞTİR** — yalnızca "Confirm
  signup" ele alınmıştır.
