import { absoluteUrl } from "@/lib/site";

/**
 * Yapılandırılmış veri (schema.org). `<` karakteri kaçırılır; içerik
 * yalnızca sunucuda üretilen sabit metinlerden gelir.
 */
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}

export interface FaqItem {
  q: string;
  a: string;
}

export function faqJsonLd(items: FaqItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((i) => ({
      "@type": "Question",
      name: i.q,
      acceptedAnswer: { "@type": "Answer", text: i.a },
    })),
  };
}

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Parakip",
    url: absoluteUrl("/"),
    logo: absoluteUrl("/brand/icon-512.png"),
  };
}

/** Uygulama + gerçek fiyatlar. Kullanıcı yorumu/puanı YOKTUR, eklenmez. */
export function softwareJsonLd(prices: { homeMonthly: number; homeYearly: number; businessMonthly: number; businessYearly: number }) {
  const offer = (name: string, price: number, unit: "MON" | "ANN") => ({
    "@type": "Offer",
    name,
    price: String(price),
    priceCurrency: "TRY",
    priceSpecification: { "@type": "UnitPriceSpecification", price: String(price), priceCurrency: "TRY", unitCode: unit },
  });
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Parakip",
    applicationCategory: "FinanceApplication",
    operatingSystem: "Web, iOS, Android",
    url: absoluteUrl("/"),
    inLanguage: "tr",
    offers: [
      { "@type": "Offer", name: "Ücretsiz", price: "0", priceCurrency: "TRY" },
      offer("Ev Premium (aylık)", prices.homeMonthly, "MON"),
      offer("Ev Premium (yıllık)", prices.homeYearly, "ANN"),
      offer("İşletme Premium (aylık)", prices.businessMonthly, "MON"),
      offer("İşletme Premium (yıllık)", prices.businessYearly, "ANN"),
    ],
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((i, idx) => ({ "@type": "ListItem", position: idx + 1, name: i.name, item: absoluteUrl(i.path) })),
  };
}
