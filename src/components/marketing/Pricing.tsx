import {
  BUSINESS_FREE_LIMITS,
  FREE_EXTRA_MEMBER_LIMIT,
  FREE_SAVINGS_GOAL_LIMIT,
  HOME_FREE_ACCOUNT_LIMIT,
  getPlanPrices,
} from "@/lib/plans/pricing";
import { freeMonths } from "@/lib/plans/planParam";
import { signupHref, type SignupSource } from "@/lib/marketing/attribution";
import { SectionHeading } from "@/components/marketing/MarketingShell";
import { PricingToggle, type PricingPlan } from "@/components/marketing/PricingToggle";

/**
 * Fiyatlandırma bölümü. Fiyatlar ve ücretsiz plan limitleri uygulamanın
 * plan ekranıyla AYNI kaynaktan (lib/plans/pricing.ts) okunur.
 * `only` ile iniş sayfalarında yalnızca ilgili planlar gösterilir.
 */
export function Pricing({
  page,
  utm,
  only,
  title = "Basit fiyatlar",
}: {
  page: string;
  utm: SignupSource | null;
  only?: ("free" | "home" | "business")[];
  title?: string;
}) {
  const prices = getPlanPrices();
  const homeFree = freeMonths(prices.homeMonthly, prices.homeYearly);
  const businessFree = freeMonths(prices.businessMonthly, prices.businessYearly);
  const href = (plan: string | null, type?: string) => signupHref({ plan, type, page, utm });

  const all: PricingPlan[] = [
    {
      key: "free",
      name: "Ücretsiz",
      monthly: 0,
      yearly: 0,
      freeMonths: 0,
      features: [
        "Gelir-gider, borç-alacak, bütçe ve yatırım takibi",
        `Evde ${HOME_FREE_ACCOUNT_LIMIT} hesap (banka, nakit, kart)`,
        `İşletmede ${BUSINESS_FREE_LIMITS.accounts} hesap, ayda ${BUSINESS_FREE_LIMITS.monthlyTransactions} kayıt`,
        `Sen + ${FREE_EXTRA_MEMBER_LIMIT} kişi birlikte kullanabilir`,
        `${FREE_SAVINGS_GOAL_LIMIT} birikim hedefi, otomatik tekrarlayan kayıtlar`,
        "Aylık özet, telefon bildirimleri, raporlar",
      ],
      cta: "Ücretsiz başla",
      href: { monthly: href(null), yearly: href(null) },
    },
    {
      key: "home",
      name: "Ev Premium",
      badge: "Aileler için",
      highlight: true,
      monthly: prices.homeMonthly,
      yearly: prices.homeYearly,
      freeMonths: homeFree,
      features: [
        "Ücretsiz plandaki her şey",
        "Sınırsız hesap",
        "Tüm aile birlikte kullanır (sınırsız üye)",
        "Sınırsız birikim hedefi",
        "Alan sahibi Premium ise herkes yararlanır",
      ],
      cta: "Ev Premium ile başla",
      href: { monthly: href("home_monthly"), yearly: href("home_yearly") },
    },
    {
      key: "business",
      name: "İşletme Premium",
      monthly: prices.businessMonthly,
      yearly: prices.businessYearly,
      freeMonths: businessFree,
      note: "işletme başına",
      features: [
        "Ücretsiz plandaki her şey",
        "Sınırsız hesap, kayıt ve borç-alacak",
        "Sınırsız müşteri ve tedarikçi",
        "Ekibini ve muhasebecini ekle, yetkiyi sen belirle",
        "Sınırsız birikim hedefi",
      ],
      cta: "İşletme Premium ile başla",
      href: { monthly: href("business_monthly"), yearly: href("business_yearly") },
    },
  ];
  const plans = only ? all.filter((p) => only.includes(p.key)) : all;

  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6" id="fiyatlandirma" aria-labelledby="fiyat-baslik">
      <SectionHeading
        id="fiyat-baslik"
        title={title}
        description="Ücretsiz başla, ihtiyacın büyüyünce Premium'a geç. Otomatik yenileme yok; kartla veya havale/EFT ile ödersin."
      />
      <PricingToggle plans={plans} maxFreeMonths={Math.max(...plans.map((p) => p.freeMonths), 0)} />
    </section>
  );
}
