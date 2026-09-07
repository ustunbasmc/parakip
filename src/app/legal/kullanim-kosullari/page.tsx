import { LegalPageShell } from "@/components/legal/LegalPageShell";

export const metadata = { title: "Kullanım Koşulları | Parakip" };

/**
 * ⚠️ TASLAK: Köşeli parantez [...] alanları doldurulmalı, yayına almadan
 * önce bir avukat tarafından incelenmelidir.
 */
export default function TermsPage() {
  return (
    <LegalPageShell title="Kullanım Koşulları" lastUpdated="[TARİH GİRİLECEK]">
      <p>
        Bu Kullanım Koşulları (&quot;Sözleşme&quot;), [ŞİRKET UNVANI] (&quot;Parakip&quot;) tarafından sunulan
        Parakip uygulamasını kullanımınızı düzenler. Uygulamayı kullanarak bu koşulları kabul etmiş
        sayılırsınız.
      </p>

      <section>
        <h2 className="text-lg font-bold text-text-primary">1. Hizmetin Tanımı</h2>
        <p>Parakip, kişisel ve küçük işletme finans takibi (gelir/gider, borç/alacak, bütçe, yatırım takibi)
          sağlayan bir yazılım hizmetidir. Parakip bir bankacılık, yatırım danışmanlığı veya muhasebe hizmeti
          DEĞİLDİR — yalnızca kendi girdiğiniz verileri düzenlemenize yardımcı olur.</p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-text-primary">2. Hesap Sorumluluğu</h2>
        <p>Hesap bilgilerinizin (şifre dahil) gizliliğinden siz sorumlusunuz. Hesabınızda gerçekleşen tüm
          işlemlerden, aksi yasal olarak belirlenmedikçe, siz sorumlu tutulursunuz.</p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-text-primary">3. Girdiğiniz Veriler</h2>
        <p>Uygulamaya girdiğiniz finansal veriler (tutarlar, hesap adları vb.) size aittir. Parakip, bu
          verilerin doğruluğunu garanti etmez — veri girişindeki doğruluk kullanıcının sorumluluğundadır.</p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-text-primary">4. Ücretli Plan (İşletme Aboneliği)</h2>
        <p>İşletme aboneliği, Shopier üzerinden tek seferlik ödeme ile satın alınır ve belirli bir süre
          (aylık/yıllık) boyunca geçerlidir. <strong>Bu abonelik otomatik olarak yenilenmez</strong> — süre
          dolduğunda erişiminiz ücretsiz plana döner, tekrar satın almanız gerekir. Ödeme/iade koşulları için{" "}
          <span className="font-semibold">Mesafeli Satış Sözleşmesi</span> ve{" "}
          <span className="font-semibold">İptal ve İade Politikası</span>&apos;na bakınız.</p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-text-primary">5. Finansal Kayıtların Saklanması</h2>
        <p>Parakip, finansal geçmişinizin bütünlüğünü korumak için işlem kayıtlarını fiziksel olarak
          SİLMEZ — bir kayıt &quot;iptal edildi&quot; olarak işaretlenir ama geçmişte görünmeye devam eder.
          Bu, muhasebe/denetim amaçlı bir tasarım kararıdır.</p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-text-primary">6. Sorumluluğun Sınırlandırılması</h2>
        <p>Parakip, hizmetin kesintisiz veya hatasız çalışacağını garanti etmez. Yasaların izin verdiği
          azami ölçüde, dolaylı zararlardan sorumlu tutulamaz.</p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-text-primary">7. Değişiklikler</h2>
        <p>Bu koşulları zaman zaman güncelleyebiliriz. Önemli değişiklikler uygulama içinden veya
          e-posta yoluyla bildirilir.</p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-text-primary">8. Uygulanacak Hukuk</h2>
        <p>Bu sözleşme Türkiye Cumhuriyeti kanunlarına tabidir. Uyuşmazlıklarda [İL] Mahkemeleri ve İcra
          Daireleri yetkilidir.</p>
      </section>
    </LegalPageShell>
  );
}
