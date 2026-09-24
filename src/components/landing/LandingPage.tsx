import Link from "next/link";
import { getPlanPrices } from "@/lib/plans/pricing";
import { signupHref, type SignupSource } from "@/lib/marketing/attribution";
import { MarketingShell, SectionHeading } from "@/components/marketing/MarketingShell";
import { PhoneMockup } from "@/components/marketing/PhoneMockup";
import { Pricing } from "@/components/marketing/Pricing";
import { Faq } from "@/components/marketing/Faq";
import { JsonLd, organizationJsonLd, softwareJsonLd, type FaqItem } from "@/components/marketing/JsonLd";
import { BenefitGrid, CtaBand, HeroCtas, StepsSection, TrustList, type Benefit } from "@/components/marketing/sections";
import {
  ArrowDownRightIcon,
  BellIcon,
  BuildingIcon,
  ClockIcon,
  PieChartIcon,
  ShieldIcon,
  SparkleIcon,
  TrendingUpIcon,
  WalletIcon,
} from "@/components/icons";

const BENEFITS: Benefit[] = [
  { icon: PieChartIcon, title: "Paranın nereye gittiğini gör", text: "Her harcama kendi kategorisinde toplanır. Ay sonunda en çok neye harcadığını tek bakışta görürsün." },
  { icon: ClockIcon, title: "Maaş, kira, abonelik kendiliğinden işlensin", text: "Bir kez tanımla; her ay otomatik kaydedilsin. Elle girmeyi unutma derdi biter." },
  { icon: ArrowDownRightIcon, title: "Borcunu, alacağını unutma", text: "Kime ne kadar borçlu, kimden ne kadar alacaklı olduğunu bil. Vadesi yaklaşınca haber verelim." },
  { icon: WalletIcon, title: "Bütçeni aşmadan uyaralım", text: "Market, eğlence, faturalar için sınır koy. %80'e geldiğinde ve aştığında bildirim gelsin." },
  { icon: TrendingUpIcon, title: "Ne kadar varlığın olduğunu bil", text: "Hesaplar, yatırımlar ve alacaklar eksi borçlar: net değerin ve aylar içindeki değişimi tek ekranda." },
  { icon: SparkleIcon, title: "Her ay kısa bir özet", text: "\"Geçen aya göre %12 daha az harcadın, en çok market\" gibi kısa ve net cümlelerle ayını anla." },
  { icon: BellIcon, title: "Telefonuna bildirim gelsin", text: "Parakip'i ana ekranına ekle, uygulama gibi kullan. Vade ve bütçe uyarıları kilit ekranına düşsün." },
  { icon: BuildingIcon, title: "Evin ve işin karışmasın", text: "Ev ve işletme için ayrı alanlar. Aynı hesapla ikisini de yönet, rakamlar birbirine karışmasın." },
];

const FAQ: FaqItem[] = [
  {
    q: "Parakip gerçekten ücretsiz mi?",
    a: "Evet. Ücretsiz planın süre sınırı yok ve kredi kartı istemiyoruz. Gelir-gider, borç-alacak, bütçe, yatırım takibi ve raporlar ücretsiz planda var. Daha fazla hesap, üye veya birikim hedefi gerekirse isteğe bağlı olarak Premium'a geçebilirsin.",
  },
  {
    q: "Banka hesabıma bağlanıyor musunuz?",
    a: "Hayır. Parakip banka şifreni istemez ve bankana bağlanmaz. Kayıtlarını sen girersin; maaş, kira ve abonelik gibi düzenli kayıtları bir kez tanımlarsan her ay otomatik oluşturulur.",
  },
  {
    q: "Verilerim güvende mi?",
    a: "Veriler şifreli bağlantı üzerinden taşınır ve Avrupa'daki (Frankfurt) sunucularda saklanır. Her alanın kayıtlarını yalnızca o alanın sahibi ve davet ettiği kişiler görebilir; kimin neyi görüp düzenleyebileceğini sen belirlersin.",
  },
  {
    q: "Ailemle veya ortağımla birlikte kullanabilir miyim?",
    a: "Evet. Alanına kişi davet edebilir, her birine yönetici, düzenleyici veya yalnızca görüntüleyici yetkisi verebilirsin. Ücretsiz planda sana ek olarak 1 kişi, Premium'da sınırsız kişi ekleyebilirsin.",
  },
  {
    q: "Evimin ve işletmemin hesaplarını ayrı tutabilir miyim?",
    a: "Evet. Ev ve işletme için ayrı alanlar oluşturursun; rakamlar birbirine karışmaz. Aynı hesapla iki alan arasında tek dokunuşla geçersin.",
  },
  {
    q: "Premium'u nasıl öderim, otomatik yenilenir mi?",
    a: "Kredi/banka kartıyla (Shopier) veya havale/EFT ile ödeyebilirsin. Otomatik yenileme yoktur. Süre bitince ücretsiz plana dönersin; kayıtların silinmez.",
  },
  {
    q: "Telefonuma uygulama olarak yükleyebilir miyim?",
    a: "Evet. Uygulama mağazasına gerek yok: Android'de tarayıcıdan \"Uygulamayı yükle\", iPhone'da Safari'de Paylaş → \"Ana Ekrana Ekle\" demen yeterli. Ardından telefon bildirimlerini açabilirsin.",
  },
  {
    q: "Döviz ve yatırımlarımı takip edebilir miyim?",
    a: "Evet. Döviz hesapların güncel TCMB kuruyla TL'ye çevrilerek net değerine katılır; yatırım alım-satımlarını ve maliyetini takip edebilirsin. Parakip yatırım tavsiyesi vermez.",
  },
  {
    q: "e-Fatura kesebilir miyim?",
    a: "Hayır. Parakip bir ön muhasebe ve para takip uygulamasıdır; resmi defter veya e-Fatura yerine geçmez. Kayıtlarını dışa aktarıp muhasebecinle paylaşabilir ya da onu alanına görüntüleyici olarak ekleyebilirsin.",
  },
  {
    q: "Verilerimi indirebilir veya hesabımı silebilir miyim?",
    a: "Evet. Tüm kayıtlarını tek dosyada indirebilir, hareketlerini Excel'de açılan CSV olarak alabilirsin. Hesabını sildiğinde 7 günlük bekleme süresinden sonra hesabın ve verilerin kalıcı olarak silinir.",
  },
];

/**
 * Oturum açmamış ziyaretçiler için tanıtım sayfası (sunucu bileşeni; arama
 * motorları tam içeriği görür). Yalnızca GERÇEKTEN var olan özellikler
 * anlatılır; teknik terimler yerine kullanıcının göreceği fayda yazılır.
 * Fiyatlar ve limitler uygulamanın plan ekranıyla aynı kaynaktan gelir.
 */
export function LandingPage({ utm }: { utm: SignupSource | null }) {
  const cta = signupHref({ page: "/", utm });
  const prices = getPlanPrices();

  return (
    <MarketingShell signupHref={cta}>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full opacity-25 blur-3xl"
          style={{ background: "var(--color-accent)" }}
        />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-10 sm:px-6 sm:pt-16 lg:grid-cols-[1.1fr_1fr] lg:gap-10 lg:pb-24 lg:pt-20">
          <div className="flex flex-col items-start gap-5">
            <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-bold text-accent">Ev ve işletme için ücretsiz para takibi</span>
            <h1 className="text-[2.5rem] font-extrabold leading-[1.05] tracking-tight text-text-primary sm:text-5xl lg:text-6xl">
              Paranın nereye gittiğini <span className="text-accent">ilk ay</span> gör.
            </h1>
            <p className="max-w-xl text-lg text-text-secondary">
              Gelirini, giderini, borcunu ve birikimini tek ekranda topla. Her ay neye ne kadar harcadığını sade bir
              dille gör, nerede tasarruf edebileceğini bil.
            </p>
            <HeroCtas primaryHref={cta} secondaryHref="#nasil" secondaryLabel="Nasıl çalışır?" />
            <TrustList items={["Kart gerekmez", "Banka şifreni istemez", "Telefona uygulama gibi yüklenir"]} />
          </div>
          <PhoneMockup variant="home" />
        </div>
      </section>

      {/* FAYDALAR */}
      <section className="border-y border-border bg-surface/40 px-4 py-16 sm:px-6" id="ozellikler" aria-labelledby="fayda-baslik">
        <div className="mx-auto max-w-6xl">
          <SectionHeading
            id="fayda-baslik"
            eyebrow="Neler yapabilirsin"
            title="Excel tablosu değil, cebindeki muhasebeci"
            description="Karmaşık finans terimleri yok. Sadece bilmen gerekenler, ihtiyacın olduğu anda."
          />
          <BenefitGrid items={BENEFITS} />
        </div>
      </section>

      {/* EV / İŞLETME */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6" aria-labelledby="kimler-baslik">
        <SectionHeading id="kimler-baslik" title="İster evin için, ister işin için" />
        <div className="grid gap-5 md:grid-cols-2">
          <Link href="/ev-butcesi" className="group flex flex-col gap-3 rounded-3xl border border-border bg-surface p-7 transition-colors hover:border-accent">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft text-accent">
              <WalletIcon size={20} />
            </span>
            <h3 className="text-lg font-bold text-text-primary">Aile bütçesi</h3>
            <p className="text-sm text-text-secondary">
              Eşinle birlikte kullan, market ve faturaları takip et, ay sonunu rahat getir, tatil için birikim yap.
            </p>
            <span className="mt-auto text-sm font-bold text-accent">Ev bütçesi için Parakip →</span>
          </Link>
          <Link href="/esnaf-gelir-gider" className="group flex flex-col gap-3 rounded-3xl border border-border bg-surface p-7 transition-colors hover:border-accent">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft text-accent">
              <BuildingIcon size={20} />
            </span>
            <h3 className="text-lg font-bold text-text-primary">Esnaf ve küçük işletme</h3>
            <p className="text-sm text-text-secondary">
              Kasa ve bankayı, veresiyeyi, tedarikçi borcunu tek yerde tut. Muhasebecine yalnızca görme yetkisi ver.
            </p>
            <span className="mt-auto text-sm font-bold text-accent">İşletmen için Parakip →</span>
          </Link>
        </div>
      </section>

      {/* 3 ADIM */}
      <StepsSection
        id="nasil"
        steps={[
          { title: "Ücretsiz hesap aç", text: "E-posta veya Google ile 30 saniyede. Kart bilgisi istemiyoruz." },
          { title: "Hesaplarını ekle", text: "Banka, nakit ve kredi kartlarını bakiyeleriyle ekle; maaş ve kira gibi düzenli kayıtları bir kez tanımla." },
          { title: "Harcamanı gir, gerisini bırak", text: "Her harcama saniyeler sürer. Ay sonunda paranın nereye gittiğini ve ne kadar biriktirdiğini gör." },
        ]}
        ctaHref={cta}
      />

      {/* GÜVEN */}
      <section className="border-y border-border bg-surface/40 px-4 py-16 sm:px-6" aria-labelledby="guven-baslik">
        <div className="mx-auto grid max-w-5xl items-center gap-10 md:grid-cols-2">
          <div>
            <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft text-accent">
              <ShieldIcon size={20} />
            </span>
            <h2 id="guven-baslik" className="mb-3 text-2xl font-extrabold tracking-tight text-text-primary sm:text-3xl">
              Paran senin, verin de
            </h2>
            <p className="text-text-secondary">
              Parakip bankana bağlanmaz, şifreni istemez. Kayıtlarını kimin görebileceğine sen karar verirsin; istediğin an
              hepsini indirip hesabını silebilirsin.
            </p>
          </div>
          <TrustList
            vertical
            items={[
              "Verini yalnızca sen ve davet ettiğin kişiler görür",
              "Muhasebecine veya eşine yalnızca görme yetkisi verebilirsin",
              "Sunucular Avrupa'da (Frankfurt), bağlantı şifreli",
              "Tüm kayıtlarını tek dosyada indir, dilediğinde hesabını sil",
            ]}
          />
        </div>
      </section>

      <Pricing page="/" utm={utm} />

      {/* KAYNAKLAR */}
      <section className="mx-auto max-w-6xl px-4 pb-4 sm:px-6" aria-label="Ücretsiz kaynaklar">
        <div className="grid gap-5 md:grid-cols-2">
          <Link href="/butce-sablonu" className="flex flex-col gap-2 rounded-3xl border border-border bg-surface p-7 hover:border-accent">
            <span className="text-xs font-bold uppercase tracking-wide text-accent">Ücretsiz</span>
            <h3 className="text-lg font-bold text-text-primary">Aylık bütçe şablonu</h3>
            <p className="text-sm text-text-secondary">Tarayıcıda doldur ya da Excel olarak indir. Kayıt gerekmez.</p>
            <span className="mt-2 text-sm font-bold text-accent">Şablonu aç →</span>
          </Link>
          <Link href="/rehber" className="flex flex-col gap-2 rounded-3xl border border-border bg-surface p-7 hover:border-accent">
            <span className="text-xs font-bold uppercase tracking-wide text-accent">Rehber</span>
            <h3 className="text-lg font-bold text-text-primary">Bütçe, borç ve birikim rehberleri</h3>
            <p className="text-sm text-text-secondary">Aile bütçesinden esnaf defterine, kredi kartı borcundan acil durum fonuna.</p>
            <span className="mt-2 text-sm font-bold text-accent">Rehberleri oku →</span>
          </Link>
        </div>
      </section>

      <Faq items={FAQ} />

      <CtaBand href={cta} title="Bu ay farkı gör" text="İlk ayın sonunda paranın nereye gittiğini bileceksin. Ücretsiz, kart gerekmez." />

      <JsonLd data={[organizationJsonLd(), softwareJsonLd(prices)]} />
    </MarketingShell>
  );
}
