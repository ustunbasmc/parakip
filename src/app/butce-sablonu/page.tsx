import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { BudgetTemplate } from "@/components/marketing/BudgetTemplate";
import { CtaBand } from "@/components/marketing/sections";
import { Faq } from "@/components/marketing/Faq";
import type { FaqItem } from "@/components/marketing/JsonLd";
import { signupHref } from "@/lib/marketing/attribution";

const PAGE = "/butce-sablonu";
const XLSX = "/butce-sablonu/parakip-aylik-butce-sablonu.xlsx";

export const metadata: Metadata = {
  title: "Ücretsiz Aylık Bütçe Şablonu (Excel ve Online) | Parakip",
  description:
    "Ücretsiz aylık bütçe şablonu: gelir ve giderlerini gir, ihtiyaç-istek-birikim dağılımını ve kalan tutarı anında gör. Tarayıcıda doldur veya Excel olarak indir. Kayıt gerekmez.",
  alternates: { canonical: PAGE },
  openGraph: {
    title: "Ücretsiz aylık bütçe şablonu",
    description: "Tarayıcıda doldur veya Excel olarak indir. İhtiyaç, istek ve birikim dağılımın anında hesaplansın.",
    url: PAGE,
    siteName: "Parakip",
    locale: "tr_TR",
    type: "website",
  },
};

const FAQ: FaqItem[] = [
  {
    q: "Şablon gerçekten ücretsiz mi, kayıt gerekiyor mu?",
    a: "Evet, tamamen ücretsiz ve kayıt gerekmez. Tarayıcıda doldurabilir ya da Excel dosyasını indirip kendi bilgisayarında kullanabilirsin.",
  },
  {
    q: "Girdiğim rakamlar bir yere gönderiliyor mu?",
    a: "Hayır. Tarayıcıdaki şablona girdiğin rakamlar yalnızca kendi tarayıcında saklanır; Parakip'e veya başka bir sunucuya gönderilmez. Temizle düğmesiyle istediğin an silebilirsin.",
  },
  {
    q: "Excel dosyası hangi programlarda açılır?",
    a: "Dosya standart .xlsx biçimindedir; Microsoft Excel, Google E-Tablolar, LibreOffice ve Numbers ile açılır. Toplamlar ve oranlar formüllerle kendiliğinden hesaplanır.",
  },
  {
    q: "Planlanan ve gerçekleşen sütunları ne işe yarar?",
    a: "Excel şablonunda ay başında hedeflediğin tutarları Planlanan, ay sonunda gerçekte harcadıklarını Gerçekleşen sütununa yazarsın; aradaki fark hangi kategoride sapma olduğunu gösterir.",
  },
];

export default function ButceSablonuPage() {
  const cta = signupHref({ page: PAGE });
  return (
    <MarketingShell signupHref={cta}>
      <div className="mx-auto max-w-6xl px-4 pb-10 pt-8 sm:px-6 sm:pt-12">
        <nav aria-label="Konum" className="mb-4 flex flex-wrap items-center gap-1.5 text-xs text-text-muted print:hidden">
          <Link href="/" className="hover:text-text-primary">Ana sayfa</Link>
          <span aria-hidden="true">/</span>
          <Link href="/rehber" className="hover:text-text-primary">Rehber</Link>
        </nav>
        <p className="text-xs font-bold uppercase tracking-wide text-accent">Ücretsiz kaynak</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-text-primary sm:text-4xl">Aylık bütçe şablonu</h1>
        <p className="mt-3 max-w-2xl text-text-secondary">
          Gelirlerini ve giderlerini gir; ihtiyaç, istek ve birikim dağılımın ile ay sonunda kalan tutar anında hesaplansın.
          Excel sürümünde &quot;Planlanan&quot; ve &quot;Gerçekleşen&quot; sütunlarıyla ay sonunda sapmaları da görebilirsin. Nasıl
          doldurulacağını <Link href="/rehber/aile-butcesi-nasil-yapilir" className="font-semibold text-accent">aile bütçesi rehberinde</Link> adım adım anlattık.
        </p>

        <div className="mt-8">
          <BudgetTemplate xlsxHref={XLSX} />
        </div>
      </div>

      <div className="print:hidden">
        <CtaBand
          href={cta}
          title="Bunu her ay elle yapma"
          text="Parakip harcamalarını kategorilere ayırır, bütçeni takip eder, sınırı aşmadan uyarır ve ay sonunda özetler. Ücretsiz."
          label="Parakip'i ücretsiz dene"
        />
        <Faq items={FAQ} title="Şablon hakkında" />
      </div>
    </MarketingShell>
  );
}
