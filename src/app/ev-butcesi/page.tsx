import type { Metadata } from "next";
import Link from "next/link";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { parseSignupSource, signupHref } from "@/lib/marketing/attribution";
import { MarketingShell, SectionHeading } from "@/components/marketing/MarketingShell";
import { PhoneMockup } from "@/components/marketing/PhoneMockup";
import { Pricing } from "@/components/marketing/Pricing";
import { Faq } from "@/components/marketing/Faq";
import { BenefitGrid, CtaBand, HeroCtas, ProblemSolution, StepsSection, TrustList, type Benefit } from "@/components/marketing/sections";
import type { FaqItem } from "@/components/marketing/JsonLd";
import { BellIcon, ClockIcon, PieChartIcon, SparkleIcon, TrendingUpIcon, UsersIcon, WalletIcon, ArrowDownRightIcon } from "@/components/icons";

const PAGE = "/ev-butcesi";

export const metadata: Metadata = {
  title: "Aile Bütçesi Uygulaması — Ücretsiz Ev Bütçesi Takibi | Parakip",
  description:
    "Aile bütçeni eşinle birlikte yönet: market, fatura, kira ve kredi kartı harcamalarını takip et, bütçe sınırı koy, birikim hedefine ulaş. Ücretsiz, kart gerekmez.",
  alternates: { canonical: PAGE },
  openGraph: {
    title: "Aile bütçeni birlikte, kavga etmeden yönet",
    description: "Ücretsiz aile bütçesi uygulaması: harcama takibi, bütçe uyarıları, birikim hedefleri ve aylık özet.",
    url: PAGE,
    siteName: "Parakip",
    locale: "tr_TR",
    type: "website",
  },
};

const BENEFITS: Benefit[] = [
  { icon: UsersIcon, title: "Eşinle aynı bütçe", text: "Aynı Ev alanını birlikte kullanın. Herkes kendi telefonundan kaydeder, toplam tek yerde görünür." },
  { icon: PieChartIcon, title: "Market, fatura, eğlence ayrı ayrı", text: "Harcamalar kategorilere ayrılır. Hangi kalemin bütçeyi zorladığını hemen görürsün." },
  { icon: WalletIcon, title: "Bütçe sınırı ve uyarı", text: "Her kategori için aylık sınır koy; %80'e geldiğinde ve aştığında bildirim gelsin." },
  { icon: ClockIcon, title: "Kira, aidat, abonelik otomatik", text: "Düzenli ödemeleri bir kez tanımla; her ay kendiliğinden kaydedilsin, vadesi yaklaşınca hatırlatılsın." },
  { icon: TrendingUpIcon, title: "Birikim hedefleri", text: "Tatil, araba, acil durum fonu: hedefe ne kadar kaldığını ve ayda ne ayırman gerektiğini gör." },
  { icon: ArrowDownRightIcon, title: "Borç ve alacak defteri", text: "Arkadaşına verdiğin borcu, kredi kartı ve taksit borçlarını unutma." },
  { icon: SparkleIcon, title: "Ay sonunda kısa özet", text: "\"Geçen aya göre %12 daha az harcadın, en çok market\" gibi sade cümlelerle ayını değerlendir." },
  { icon: BellIcon, title: "Telefonuna bildirim", text: "Uygulama gibi ana ekrana ekle; vade ve bütçe uyarıları kilit ekranına düşsün." },
];

const FAQ: FaqItem[] = [
  {
    q: "Eşimle aynı anda kullanabilir miyiz?",
    a: "Evet. Ev alanına eşini davet edersin; ikiniz de kendi telefonunuzdan kayıt girersiniz, bakiyeler ve bütçe ikinizde de aynı anda güncellenir. Ücretsiz planda sana ek olarak 1 kişi, Ev Premium'da sınırsız aile üyesi ekleyebilirsin.",
  },
  {
    q: "Kredi kartı harcamalarını nasıl takip ederim?",
    a: "Kredi kartını bir hesap olarak eklersin ve harcamaları o karttan girersin. Kartın bakiyesi (borcun) ve karttan yaptığın harcamalar ayrıca görünür.",
  },
  {
    q: "Aile bütçesi yapmaya nereden başlamalıyım?",
    a: "Önce bir ay boyunca harcamalarını kaydet; Parakip bunları kategorilere ayırır. Ay sonunda hangi kalemlere ne kadar gittiğini gördüğünde, market veya eğlence gibi kategorilere gerçekçi sınırlar koyabilirsin. Adım adım anlatım için rehberimize bakabilirsin.",
  },
  {
    q: "Ücretsiz plan bir aileye yeter mi?",
    a: "Çoğu aile için evet: 5 hesap (ör. iki banka, nakit, iki kredi kartı), sınırsız kayıt, bütçe, raporlar ve sana ek 1 kişi ücretsizdir. Daha fazla hesap, daha fazla aile üyesi veya birden çok birikim hedefi gerekirse Ev Premium'a geçebilirsin.",
  },
  {
    q: "Banka bilgilerimi istiyor musunuz?",
    a: "Hayır. Parakip bankana bağlanmaz, internet bankacılığı şifreni istemez. Kayıtları siz girersiniz; düzenli ödemeler otomatik oluşturulabilir.",
  },
  {
    q: "Kayıtlarımızı başka kim görebilir?",
    a: "Yalnızca Ev alanına davet ettiğin kişiler. Birine yalnızca görme yetkisi de verebilirsin. İstediğin an tüm kayıtlarını indirebilir veya hesabını silebilirsin.",
  },
];

export default async function EvButcesiPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const utm = parseSignupSource(await searchParams);
  const supabase = await createClient();
  const isSignedIn = Boolean(await getSessionUser(supabase));
  const cta = signupHref({ type: "home", page: PAGE, utm });

  return (
    <MarketingShell signupHref={cta} isSignedIn={isSignedIn}>
      <section className="relative overflow-hidden">
        <div aria-hidden="true" className="pointer-events-none absolute -left-40 -top-40 h-[480px] w-[480px] rounded-full opacity-20 blur-3xl" style={{ background: "var(--color-accent)" }} />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-10 sm:px-6 sm:pt-16 lg:grid-cols-[1.1fr_1fr] lg:pb-24 lg:pt-20">
          <div className="flex flex-col items-start gap-5">
            <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-bold text-accent">Ücretsiz aile bütçesi uygulaması</span>
            <h1 className="text-[2.4rem] font-extrabold leading-[1.05] tracking-tight text-text-primary sm:text-5xl lg:text-[3.4rem]">
              Aile bütçeni birlikte, <span className="text-accent">kavga etmeden</span> yönet.
            </h1>
            <p className="max-w-xl text-lg text-text-secondary">
              Eşinle aynı bütçeyi kullan, market ve faturaları takip et, ay sonunu rahat getir. Parakip her ay paranın
              nereye gittiğini ve ne kadar biriktirdiğinizi sade bir dille gösterir.
            </p>
            <HeroCtas primaryHref={cta} secondaryHref="#nasil" secondaryLabel="Nasıl çalışır?" />
            <TrustList items={["Kart gerekmez", "Eşinle ücretsiz paylaş", "Banka şifresi istemez"]} />
          </div>
          <PhoneMockup variant="home" />
        </div>
      </section>

      <ProblemSolution
        title="Tanıdık geldi mi?"
        items={[
          { problem: "Maaş yatıyor, ayın 20'sinde bitiyor.", solution: "Her harcama kategoriye ayrılır; paranın hangi kalemde eridiğini ilk ay görürsün." },
          { problem: "Kimin neyi ödediği hep karışıyor.", solution: "Aynı Ev alanını birlikte kullanın; herkes kendi telefonundan kaydeder, toplam tek yerde." },
          { problem: "Faturayı, kirayı, aidatı son gün hatırlıyoruz.", solution: "Düzenli ödemeler otomatik kaydedilir, vadesi yaklaşınca telefonuna bildirim gelir." },
          { problem: "Tatil için biriktirmek hep sonraya kalıyor.", solution: "Birikim hedefi koy; hedefe ne kadar kaldığını ve ayda ne ayırman gerektiğini gör." },
        ]}
      />

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6" aria-labelledby="ev-fayda">
        <SectionHeading id="ev-fayda" title="Aile bütçesi için ihtiyacın olan her şey" description="Karmaşık tablolar yok; yalnızca bilmen gerekenler." />
        <BenefitGrid items={BENEFITS} />
      </section>

      <StepsSection
        id="nasil"
        steps={[
          { title: "Ücretsiz hesap aç", text: "30 saniyede kayıt ol, Ev alanını tek adımda kur." },
          { title: "Hesaplarını ve eşini ekle", text: "Banka, nakit ve kredi kartlarını ekle; eşini davet et, birlikte kaydedin." },
          { title: "Bir ay kaydet, sonra sınır koy", text: "İlk ayın sonunda nereye ne gittiğini gör; market ve eğlence için gerçekçi bütçe belirle." },
        ]}
        ctaHref={cta}
      />

      <section className="mx-auto max-w-5xl px-4 pb-4 sm:px-6">
        <div className="grid gap-4 md:grid-cols-2">
          <Link href="/rehber/aile-butcesi-nasil-yapilir" className="rounded-3xl border border-border bg-surface p-6 hover:border-accent">
            <p className="text-xs font-bold uppercase tracking-wide text-accent">Rehber</p>
            <p className="mt-1 text-lg font-bold text-text-primary">Aile bütçesi nasıl yapılır?</p>
            <p className="mt-1 text-sm text-text-secondary">50/30/20 kuralının Türkiye&apos;ye uyarlanmış hâli, adım adım.</p>
          </Link>
          <Link href="/butce-sablonu" className="rounded-3xl border border-border bg-surface p-6 hover:border-accent">
            <p className="text-xs font-bold uppercase tracking-wide text-accent">Ücretsiz</p>
            <p className="mt-1 text-lg font-bold text-text-primary">Aylık bütçe şablonu</p>
            <p className="mt-1 text-sm text-text-secondary">Tarayıcıda doldur veya Excel olarak indir.</p>
          </Link>
        </div>
      </section>

      <Pricing page={PAGE} utm={utm} only={["free", "home"]} title="Aile için fiyatlar" />
      <Faq items={FAQ} />
      <CtaBand href={cta} title="Bu ay birlikte başlayın" text="İlk ayın sonunda ailenizin parasının nereye gittiğini bileceksiniz. Ücretsiz, kart gerekmez." />
    </MarketingShell>
  );
}
