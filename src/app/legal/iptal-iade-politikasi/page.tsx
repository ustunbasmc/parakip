import { LegalPageShell } from "@/components/legal/LegalPageShell";

export const metadata = { title: "İptal ve İade Politikası | Parakip" };

/** ⚠️ TASLAK — [İADE SÜRESİ]/[İADE E-POSTASI] gibi alanlar doldurulmalı, yayına almadan önce gözden geçirilmelidir. */
export default function RefundPolicyPage() {
  return (
    <LegalPageShell title="İptal ve İade Politikası" lastUpdated="[TARİH GİRİLECEK]">
      <section>
        <h2 className="text-lg font-bold text-text-primary">1. Ücretsiz Plan</h2>
        <p>Parakip&apos;in Ev ve İşletme temel özellikleri ücretsiz kullanılabilir — herhangi bir ödeme
          gerektirmez, iptal/iade konusu değildir.</p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-text-primary">2. Ücretli Abonelikler (Ev/İşletme Premium)</h2>
        <p>
          Ev Premium ve İşletme Premium abonelikleri, satın alma anında hizmetin ANINDA (hesabınızda)
          aktif edildiği dijital hizmetlerdir. Mesafeli Sözleşmeler Yönetmeliği m.15/1-ğ uyarınca, anında
          ifa edilen dijital içerikler için yasal cayma hakkı bulunmamaktadır.
        </p>
        <p className="mt-2">
          Buna rağmen, satın alma tarihinden itibaren <strong>[İADE SÜRESİ, ör. 7 gün]</strong> içinde
          aboneliği HİÇ KULLANMADIYSANIZ (İşletme limitlerini aşan hiçbir kayıt oluşturmadıysanız), talebiniz
          değerlendirmeye alınabilir. İade talepleri [İADE E-POSTASI] adresine yazılı olarak iletilmelidir.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-text-primary">3. Otomatik Yenileme Yoktur</h2>
        <p>
          Abonelikleriniz OTOMATİK olarak yenilenmez — süre dolduğunda kartınızdan herhangi bir ek ücret
          çekilmez. Bu nedenle &quot;aboneliği iptal etme&quot; işlemi gerekmez; yalnızca yeniden satın
          almamayı tercih edebilirsiniz.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-text-primary">4. Hatalı/Çift Ödeme</h2>
        <p>
          Teknik bir hata nedeniyle yanlışlıkla birden fazla ödeme yaptıysanız, [İADE E-POSTASI] adresine
          ödeme kanıtınızla (Shopier işlem numarası) birlikte ulaşın — mükerrer ödemeler tarafımızca
          incelenip iade edilir.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-text-primary">5. İade Süreci</h2>
        <p>
          Onaylanan iadeler, ödemenin yapıldığı Shopier hesabı/kartı üzerinden, bankanızın işlem sürelerine
          bağlı olarak genellikle [İADE İŞLEM SÜRESİ, ör. 5-10 iş günü] içinde gerçekleştirilir.
        </p>
      </section>
    </LegalPageShell>
  );
}
