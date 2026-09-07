import { LegalPageShell } from "@/components/legal/LegalPageShell";

export const metadata = { title: "Mesafeli Satış Sözleşmesi | Parakip" };

/**
 * ⚠️ TASLAK: Bu, 6502 sayılı Tüketicinin Korunması Hakkında Kanun ve
 * Mesafeli Sözleşmeler Yönetmeliği kapsamında dijital hizmet satışı
 * için GENEL bir şablondur. Köşeli parantez [...] alanları (şirket
 * bilgileri, fiyatlar) doldurulmalı ve bir avukat tarafından
 * incelenmeden YAYINA ALINMAMALIDIR.
 */
export default function DistanceSalesAgreementPage() {
  return (
    <LegalPageShell title="Mesafeli Satış Sözleşmesi" lastUpdated="[TARİH GİRİLECEK]">
      <section>
        <h2 className="text-lg font-bold text-text-primary">1. Taraflar</h2>
        <p><strong>Satıcı:</strong> [ŞİRKET UNVANI], [ADRES], [VERGİ DAİRESİ/NO]</p>
        <p><strong>Alıcı:</strong> Parakip uygulamasında İşletme aboneliği satın alan kullanıcı.</p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-text-primary">2. Sözleşmenin Konusu</h2>
        <p>
          İşbu sözleşmenin konusu, Alıcı&apos;nın Satıcı&apos;ya ait Parakip uygulaması üzerinden elektronik
          ortamda satın aldığı &quot;İşletme Premium&quot; dijital aboneliğinin satışı ve teslimine ilişkin
          tarafların hak ve yükümlülüklerinin belirlenmesidir.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-text-primary">3. Ürün/Hizmet Bilgileri</h2>
        <p>
          İşletme Premium aboneliği aylık [99,00–2.490,00 TL aralığında güncel fiyat için bkz. uygulama
          içi Planım ve Limitlerim ekranı] bedelle sunulur; ödeme Shopier ödeme altyapısı üzerinden alınır.
          Bu abonelik <strong>dijital bir hizmettir</strong>, fiziksel teslimat İÇERMEZ — satın alma
          tamamlandığında hizmet ANINDA (hesabınızda) aktif hale gelir.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-text-primary">4. Cayma Hakkı</h2>
        <p>
          Mesafeli Sözleşmeler Yönetmeliği m.15/1-ğ uyarınca, &quot;elektronik ortamda anında ifa edilen
          dijital içerikler&quot; için cayma hakkı, Alıcı&apos;nın onayı ile CAYMA HAKKININ KULLANILAMAYACAĞI
          durumlar arasındadır — Alıcı, satın alma anında hizmetin ANINDA ifasını onaylayarak cayma hakkının
          bulunmadığını kabul eder. Buna karşın Satıcı, [İSTEĞE BAĞLI: örn. ilk 14 gün içinde kullanılmamışsa
          iade politikası] uygulayabilir — güncel politika için İptal ve İade Politikası&apos;na bakınız.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-text-primary">5. Fesih</h2>
        <p>
          Bu abonelik otomatik olarak YENİLENMEZ. Süre sonunda hizmet kendiliğinden sona erer, Alıcı
          isterse yeniden satın alarak devam edebilir.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-text-primary">6. Uyuşmazlık Çözümü</h2>
        <p>
          İşbu sözleşmeden doğan uyuşmazlıklarda, Ticaret Bakanlığı&apos;nca ilan edilen değere kadar
          Tüketici Hakem Heyetleri, üzerindeki uyuşmazlıklarda ise Tüketici Mahkemeleri yetkilidir.
        </p>
      </section>
    </LegalPageShell>
  );
}
