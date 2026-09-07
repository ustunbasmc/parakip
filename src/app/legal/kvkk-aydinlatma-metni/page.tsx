import { LegalPageShell } from "@/components/legal/LegalPageShell";

export const metadata = { title: "KVKK Aydınlatma Metni | Parakip" };

/**
 * ⚠️ ÖNEMLİ: Bu metin, 6698 sayılı Kişisel Verilerin Korunması Kanunu
 * (KVKK) m.10 uyarınca gerekli olan standart başlıkları içeren bir
 * TASLAKTIR. Köşeli parantez [...] içindeki alanlar (şirket unvanı,
 * adres, MERSİS no vb.) GERÇEK bilgilerinizle DOLDURULMALIDIR. Bu metin
 * bir avukat/KVKK danışmanı tarafından incelenmeden YAYINA ALINMAMALIDIR
 * — Claude hukuki danışmanlık vermez, yalnızca genel kabul görmüş
 * yapıyı sağlar.
 */
export default function KvkkPage() {
  return (
    <LegalPageShell title="KVKK Aydınlatma Metni" lastUpdated="[TARİH GİRİLECEK]">
      <p>
        <strong>[ŞİRKET UNVANI]</strong> (&quot;Parakip&quot; veya &quot;Veri Sorumlusu&quot;) olarak, 6698 sayılı
        Kişisel Verilerin Korunması Kanunu (&quot;KVKK&quot;) uyarınca veri sorumlusu sıfatıyla, kişisel
        verilerinizin işlenmesine ilişkin sizleri bilgilendirmek isteriz.
      </p>

      <section>
        <h2 className="text-lg font-bold text-text-primary">1. Veri Sorumlusu</h2>
        <p>
          [ŞİRKET UNVANI], [ADRES], MERSİS No: [MERSİS NO] (&quot;Şirket&quot;) veri sorumlusu sıfatıyla hareket
          etmektedir.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-text-primary">2. İşlenen Kişisel Veriler</h2>
        <p>Parakip uygulaması kapsamında aşağıdaki kişisel verileriniz işlenmektedir:</p>
        <ul className="ml-5 mt-1 list-disc">
          <li>Kimlik bilgileri (ad, soyad)</li>
          <li>İletişim bilgileri (e-posta adresi, cep telefonu numarası)</li>
          <li>Müşteri işlem bilgileri (girdiğiniz finansal kayıtlar, hesap/işlem/bütçe/yatırım verileri)</li>
          <li>Ödeme işlemlerine ilişkin bilgiler (İşletme aboneliği satın alırken, ödeme sağlayıcımız üzerinden)</li>
          <li>İşlem güvenliği bilgileri (IP adresi, oturum/log kayıtları)</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-bold text-text-primary">3. İşleme Amaçları</h2>
        <p>Kişisel verileriniz; hesabınızın oluşturulması ve yönetilmesi, uygulamanın temel finansal takip
          işlevlerinin sunulması, güvenliğinizin sağlanması, yasal yükümlülüklerin yerine getirilmesi ve
          (varsa) İşletme aboneliği ödemelerinin işleme alınması amaçlarıyla işlenmektedir.</p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-text-primary">4. Hukuki Sebep</h2>
        <p>
          Kişisel verileriniz, KVKK m.5/2 kapsamında bir sözleşmenin kurulması veya ifasıyla doğrudan doğruya
          ilgili olması, veri sorumlusunun hukuki yükümlülüğünü yerine getirebilmesi ve açık rızanızın
          bulunduğu hallerde (ör. telefon numarası paylaşımı) açık rıza hukuki sebeplerine dayanılarak
          işlenmektedir.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-text-primary">5. Aktarım</h2>
        <p>
          Kişisel verileriniz, barındırma hizmeti aldığımız Supabase Inc. ve (İşletme aboneliği satın
          almanız halinde) ödeme sağlayıcımız Shopier ile, yalnızca hizmetin sunulabilmesi için gerekli
          ölçüde paylaşılabilir. Verileriniz, açık rızanız veya kanuni bir zorunluluk olmadıkça üçüncü
          taraflarla pazarlama amacıyla paylaşılmaz.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-text-primary">6. Saklama Süresi</h2>
        <p>
          Kişisel verileriniz, hesabınız aktif olduğu sürece ve ilgili mevzuatın öngördüğü zamanaşımı
          süreleri boyunca saklanır. Finansal kayıtlarınız, muhasebe/vergi mevzuatı gereği hesap silinse
          dahi belirli bir süre arşivde tutulabilir (bkz. Kullanım Koşulları).
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-text-primary">7. Haklarınız (KVKK m.11)</h2>
        <p>KVKK&apos;nın 11. maddesi uyarınca; kişisel verinizin işlenip işlenmediğini öğrenme, işlenmişse
          buna ilişkin bilgi talep etme, işlenme amacını ve amacına uygun kullanılıp kullanılmadığını
          öğrenme, yurt içinde/yurt dışında aktarıldığı üçüncü kişileri bilme, eksik/yanlış işlenmişse
          düzeltilmesini isteme, KVKK m.7 şartları çerçevesinde silinmesini/yok edilmesini isteme ve
          yapılan işlemlerin bildirilmesini isteme haklarına sahipsiniz.</p>
        <p className="mt-2">
          Bu haklarınızı kullanmak için [BAŞVURU E-POSTASI/ADRESİ] üzerinden bize ulaşabilirsiniz.
        </p>
      </section>
    </LegalPageShell>
  );
}
