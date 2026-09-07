import Link from "next/link";
import { LegalPageShell } from "@/components/legal/LegalPageShell";

export const metadata = { title: "Gizlilik Politikası | Parakip" };

/**
 * ⚠️ TASLAK: Köşeli parantez [...] alanları doldurulmalı, yayına almadan
 * önce bir avukat/KVKK danışmanı tarafından incelenmelidir.
 */
export default function PrivacyPolicyPage() {
  return (
    <LegalPageShell title="Gizlilik Politikası" lastUpdated="[TARİH GİRİLECEK]">
      <p>
        Bu Gizlilik Politikası, Parakip uygulamasını (&quot;Uygulama&quot;) kullanırken kişisel
        verilerinizin nasıl toplandığını, kullanıldığını ve korunduğunu açıklar. Kişisel verilerin işlenmesine
        ilişkin detaylı bilgi için{" "}
        <Link href="/legal/kvkk-aydinlatma-metni" className="font-semibold text-accent">
          KVKK Aydınlatma Metni
        </Link>
        &apos;ni inceleyebilirsiniz.
      </p>

      <section>
        <h2 className="text-lg font-bold text-text-primary">1. Topladığımız Bilgiler</h2>
        <p>Hesap oluştururken ad, soyad, e-posta ve cep telefonu numaranızı; uygulamayı kullanırken
          girdiğiniz finansal kayıtları (gelir, gider, borç, bütçe, yatırım vb.) topluyoruz.</p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-text-primary">2. Verilerinizi Nasıl Kullanıyoruz</h2>
        <p>Verileriniz yalnızca uygulamanın temel işlevlerini (finansal takip, bildirimler, raporlama)
          sunmak, hesabınızın güvenliğini sağlamak ve (varsa) İşletme aboneliği ödemenizi işleme almak için
          kullanılır. Verileriniz reklam/pazarlama amacıyla üçüncü taraflara satılmaz.</p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-text-primary">3. Verilerinizin Saklandığı Yer</h2>
        <p>Verileriniz, Supabase Inc. altyapısında barındırılan bir veritabanında saklanır. Veritabanı
          erişimi Satır Seviyesi Güvenlik (Row Level Security) ile korunur; yalnızca sizin ve (paylaştığınız
          alanlarda) yetkilendirdiğiniz kullanıcıların verilerine erişim sağlanır.</p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-text-primary">4. Üçüncü Taraf Hizmet Sağlayıcılar</h2>
        <ul className="ml-5 mt-1 list-disc">
          <li><strong>Supabase Inc.</strong> — veritabanı ve kimlik doğrulama altyapısı</li>
          <li><strong>Vercel Inc.</strong> — uygulama barındırma</li>
          <li><strong>Shopier</strong> — (İşletme aboneliği satın alırsanız) ödeme işleme</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-bold text-text-primary">5. Veri Güvenliği</h2>
        <p>Verilerinizi korumak için endüstri standardı şifreleme (aktarım sırasında HTTPS/TLS) ve
          erişim kontrolleri kullanıyoruz. Ancak internet üzerinden hiçbir veri iletiminin %100 güvenli
          olduğu garanti edilemez.</p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-text-primary">6. Hesap ve Veri Silme</h2>
        <p>Hesabınızı silme talebinde bulunabilirsiniz (Ayarlar → Hesap yönetimi). Kişisel bilgileriniz
          (ad, telefon, e-posta) belirli bir süre sonunda kalıcı olarak anonimleştirilir; finansal kayıtlarınız
          ise muhasebe/vergi mevzuatı gereği fiziksel olarak silinmez, arşivlenmiş olarak tutulur.</p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-text-primary">7. İletişim</h2>
        <p>Bu politika hakkında sorularınız için [BAŞVURU E-POSTASI] adresinden bize ulaşabilirsiniz.</p>
      </section>
    </LegalPageShell>
  );
}
