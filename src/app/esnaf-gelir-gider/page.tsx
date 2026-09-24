import type { Metadata } from "next";
import Link from "next/link";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { parseSignupSource, signupHref } from "@/lib/marketing/attribution";
import { BUSINESS_FREE_LIMITS } from "@/lib/plans/pricing";
import { MarketingShell, SectionHeading } from "@/components/marketing/MarketingShell";
import { PhoneMockup } from "@/components/marketing/PhoneMockup";
import { Pricing } from "@/components/marketing/Pricing";
import { Faq } from "@/components/marketing/Faq";
import { BenefitGrid, CtaBand, HeroCtas, ProblemSolution, StepsSection, TrustList, type Benefit } from "@/components/marketing/sections";
import type { FaqItem } from "@/components/marketing/JsonLd";
import { AlertIcon, ArrowDownRightIcon, BuildingIcon, ClockIcon, PieChartIcon, UsersIcon, WalletIcon, CreditCardIcon } from "@/components/icons";

const PAGE = "/esnaf-gelir-gider";

export const metadata: Metadata = {
  title: "Esnaf Gelir-Gider Takibi ve Ön Muhasebe Uygulaması | Parakip",
  description:
    "Küçük işletmen için ücretsiz gelir-gider takibi: kasa ve banka, veresiye ve alacak, tedarikçi borcu, müşteri kartları ve aylık rapor. Muhasebecine görme yetkisi ver.",
  alternates: { canonical: PAGE },
  openGraph: {
    title: "Defteri bırak, gelir-giderini telefondan tut",
    description: "Esnaf ve küçük işletmeler için ücretsiz ön muhasebe: kasa, veresiye, tedarikçi borcu ve aylık rapor.",
    url: PAGE,
    siteName: "Parakip",
    locale: "tr_TR",
    type: "website",
  },
};

const BENEFITS: Benefit[] = [
  { icon: WalletIcon, title: "Kasa, banka ve POS tek ekranda", text: "Nakit kasa, banka hesapları, POS ve kredi kartı ayrı hesaplar olarak; her birinin bakiyesi anlık." },
  { icon: ArrowDownRightIcon, title: "Veresiye ve alacak takibi", text: "Kimden ne kadar alacağın olduğunu, vadesini ve tahsilatları tek yerde tut; vade gelince hatırlatalım." },
  { icon: UsersIcon, title: "Müşteri ve tedarikçi kartları", text: "Her müşterinin ve tedarikçinin borç-alacak geçmişi kendi kartında." },
  { icon: ClockIcon, title: "Kira, maaş, fatura otomatik", text: "Düzenli giderleri bir kez tanımla; her ay kendiliğinden kaydedilsin." },
  { icon: PieChartIcon, title: "Ay sonunda kâr mı zarar mı?", text: "Aylık gelir-gider raporu, kategori dağılımı ve geçen ayla karşılaştırma." },
  { icon: BuildingIcon, title: "Ekibini ve muhasebecini ekle", text: "Çalışanın kayıt girsin, muhasebecin yalnızca görsün. Yetkiyi sen belirlersin." },
  { icon: CreditCardIcon, title: "Evinle karışmasın", text: "İşletme alanı kişisel bütçenden tamamen ayrı; aynı hesapla ikisi arasında geçiş yap." },
  { icon: AlertIcon, title: "Telefonuna bildirim", text: "Alacak vadesi, tedarikçi ödemesi ve bütçe uyarıları kilit ekranına gelsin." },
];

const FAQ: FaqItem[] = [
  {
    q: "Parakip e-Fatura veya e-Arşiv fatura keser mi?",
    a: "Hayır. Parakip bir ön muhasebe ve nakit takip uygulamasıdır; e-Fatura/e-Arşiv kesmez ve resmi defter yerine geçmez. Günlük gelir-giderini, alacak ve borçlarını takip etmen içindir; kayıtlarını muhasebecinle paylaşabilirsin.",
  },
  {
    q: "Muhasebecim kayıtlarımı görebilir mi?",
    a: "Evet. Muhasebecini işletme alanına görüntüleyici olarak davet edersen kayıtları görür ama değiştiremez. Ayrıca hareketleri Excel'de açılan CSV olarak indirip gönderebilirsin.",
  },
  {
    q: "Çalışanım kayıt girebilir mi?",
    a: "Evet. Çalışanını düzenleyici olarak eklersen satış ve gider kaydı girebilir; alanı ve üyeleri yalnızca sen ve yöneticiler yönetebilir.",
  },
  {
    q: "Ücretsiz plan işletmem için yeterli mi?",
    a: `Küçük bir işletme için genellikle evet: ücretsiz planda ${BUSINESS_FREE_LIMITS.accounts} hesap, ayda ${BUSINESS_FREE_LIMITS.monthlyTransactions} kayıt, ${BUSINESS_FREE_LIMITS.debts} borç/alacak, ${BUSINESS_FREE_LIMITS.customers} müşteri ve ${BUSINESS_FREE_LIMITS.suppliers} tedarikçi var. Bunları aşarsan İşletme Premium ile sınırsız kullanırsın.`,
  },
  {
    q: "KDV veya vergi hesaplıyor mu?",
    a: "Hayır, beyanname hazırlamaz. Tutarları kaydedip kategorilere ayırırsın; vergi ve beyan işlerini muhasebecin kayıtlarına bakarak yapar.",
  },
  {
    q: "Stok takibi var mı?",
    a: "Şu an yok. Parakip para akışına odaklanır: kasa, banka, alacak, borç ve gider takibi.",
  },
];

export default async function EsnafPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const utm = parseSignupSource(await searchParams);
  const supabase = await createClient();
  const isSignedIn = Boolean(await getSessionUser(supabase));
  const cta = signupHref({ type: "business", page: PAGE, utm });

  return (
    <MarketingShell signupHref={cta} isSignedIn={isSignedIn}>
      <section className="relative overflow-hidden">
        <div aria-hidden="true" className="pointer-events-none absolute -right-40 -top-40 h-[480px] w-[480px] rounded-full opacity-20 blur-3xl" style={{ background: "var(--color-accent)" }} />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-10 sm:px-6 sm:pt-16 lg:grid-cols-[1.1fr_1fr] lg:pb-24 lg:pt-20">
          <div className="flex flex-col items-start gap-5">
            <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-bold text-accent">Esnaf ve küçük işletme için ön muhasebe</span>
            <h1 className="text-[2.4rem] font-extrabold leading-[1.05] tracking-tight text-text-primary sm:text-5xl lg:text-[3.4rem]">
              Defteri bırak, gelir-giderini <span className="text-accent">telefondan</span> tut.
            </h1>
            <p className="max-w-xl text-lg text-text-secondary">
              Kasa ve bankayı, veresiyeyi, tedarikçi borcunu tek yerde takip et. Ay sonunda kâr mı zarar mı ettiğini gör;
              muhasebecine yalnızca görme yetkisi ver.
            </p>
            <HeroCtas primaryHref={cta} secondaryHref="#nasil" secondaryLabel="Nasıl çalışır?" />
            <TrustList items={["Ücretsiz başla, kart gerekmez", "Ekibinle birlikte kullan", "Evinle karışmaz"]} />
          </div>
          <PhoneMockup variant="business" />
        </div>
      </section>

      <ProblemSolution
        title="Esnafın bildik dertleri"
        items={[
          { problem: "Gün sonunda kasa tutmuyor.", solution: "Kasa, banka ve POS'u ayrı hesaplar olarak tut; her satış ve gider girildiği an bakiyeye yansır." },
          { problem: "Veresiye defterinde kim ne kadar borçlu belli değil.", solution: "Her müşterinin alacağı kendi kartında; vadesi gelince telefonuna hatırlatma düşer." },
          { problem: "Tedarikçiye ne zaman ne ödeyeceğimi karıştırıyorum.", solution: "Tedarikçi borçlarını vadesiyle kaydet; ödediğinde kapat, kalan borcu hep gör." },
          { problem: "Ay sonunda kâr mı zarar mı ettim bilmiyorum.", solution: "Aylık gelir-gider raporu ve \"geçen aya göre\" karşılaştırması hazır." },
        ]}
      />

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6" aria-labelledby="esnaf-fayda">
        <SectionHeading id="esnaf-fayda" title="Küçük işletmen için gereken her şey" description="Muhasebe programı karmaşası yok; günlük işin için sade bir araç." />
        <BenefitGrid items={BENEFITS} />
        <div className="mx-auto mt-8 max-w-3xl rounded-2xl border border-warning/40 bg-warning-soft p-4 text-sm text-text-secondary">
          <strong className="text-text-primary">Bilmende fayda var:</strong> Parakip e-Fatura/e-Arşiv kesmez ve resmi defter yerine geçmez.
          Ön muhasebe ve nakit takibi içindir; kayıtlarını muhasebecinle paylaşabilirsin.
        </div>
      </section>

      <StepsSection
        id="nasil"
        steps={[
          { title: "Ücretsiz hesap aç", text: "30 saniyede kayıt ol, işletme alanını tek adımda kur." },
          { title: "Kasa, banka ve müşterilerini ekle", text: "Hesaplarını açılış bakiyeleriyle ekle, veresiye müşterilerini ve tedarikçilerini gir." },
          { title: "Günlük satış ve giderini kaydet", text: "Her kayıt saniyeler sürer. Ay sonunda kâr-zarar ve alacak durumunu tek ekranda gör." },
        ]}
        ctaHref={cta}
      />

      <section className="mx-auto max-w-5xl px-4 pb-4 sm:px-6">
        <Link href="/rehber/esnaf-gelir-gider-defteri" className="block rounded-3xl border border-border bg-surface p-6 hover:border-accent">
          <p className="text-xs font-bold uppercase tracking-wide text-accent">Rehber</p>
          <p className="mt-1 text-lg font-bold text-text-primary">Esnaf için gelir-gider defteri nasıl tutulur?</p>
          <p className="mt-1 text-sm text-text-secondary">Kasa, veresiye ve tedarikçi takibini düzene sokmanın adımları.</p>
        </Link>
      </section>

      <Pricing page={PAGE} utm={utm} only={["free", "business"]} title="İşletme için fiyatlar" />
      <Faq items={FAQ} />
      <CtaBand href={cta} title="Bu ay defteri dijitale taşı" text="İlk ayın sonunda işletmenin kâr-zararını ve alacaklarını tek ekranda göreceksin." />
    </MarketingShell>
  );
}
