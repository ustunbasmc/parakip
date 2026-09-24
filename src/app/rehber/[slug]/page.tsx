import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GUIDES, getGuide } from "@/content/rehber";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { CtaBand } from "@/components/marketing/sections";
import { JsonLd, breadcrumbJsonLd } from "@/components/marketing/JsonLd";
import { signupHref } from "@/lib/marketing/attribution";
import { absoluteUrl } from "@/lib/site";

export const dynamicParams = false;

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const guide = getGuide((await params).slug);
  if (!guide) return {};
  return {
    title: `${guide.title} | Parakip Rehber`,
    description: guide.description,
    alternates: { canonical: `/rehber/${guide.slug}` },
    openGraph: {
      title: guide.title,
      description: guide.description,
      url: `/rehber/${guide.slug}`,
      siteName: "Parakip",
      locale: "tr_TR",
      type: "article",
      publishedTime: guide.published,
      modifiedTime: guide.updated,
    },
  };
}

const fmtDate = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const guide = getGuide((await params).slug);
  if (!guide) notFound();
  const page = `/rehber/${guide.slug}`;
  const cta = signupHref({ page, type: guide.audience === "business" ? "business" : null });
  const others = GUIDES.filter((g) => g.slug !== guide.slug).slice(0, 3);

  return (
    <MarketingShell signupHref={cta}>
      <article className="mx-auto max-w-3xl px-4 pb-10 pt-8 sm:px-6 sm:pt-12">
        <nav aria-label="Konum" className="mb-5 flex flex-wrap items-center gap-1.5 text-xs text-text-muted">
          <Link href="/" className="hover:text-text-primary">Ana sayfa</Link>
          <span aria-hidden="true">/</span>
          <Link href="/rehber" className="hover:text-text-primary">Rehber</Link>
        </nav>
        <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-text-primary sm:text-4xl">{guide.title}</h1>
        <p className="mt-3 text-lg text-text-secondary">{guide.description}</p>
        <p className="mt-3 text-xs text-text-muted">
          {guide.readMinutes} dk okuma · Güncelleme: {fmtDate.format(new Date(`${guide.updated}T00:00:00Z`))} · Parakip
        </p>

        <div className="guide-body mt-8 flex flex-col gap-5 text-[16px] leading-[1.75] text-text-secondary [&_a]:font-semibold [&_a]:text-accent [&_a]:underline-offset-2 hover:[&_a]:underline [&_h2]:mt-5 [&_h2]:text-2xl [&_h2]:font-extrabold [&_h2]:leading-snug [&_h2]:tracking-tight [&_h2]:text-text-primary [&_li]:pl-1 [&_strong]:text-text-primary [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-2 [&_ul]:pl-5">
          {guide.body}
        </div>

        <p className="mt-10 rounded-2xl bg-surface-muted p-4 text-xs text-text-muted">
          Bu içerik genel bilgilendirme amaçlıdır; yatırım, vergi veya hukuki tavsiye değildir. Kendi durumunuza özel kararlar için
          bir uzmana danışın.
        </p>
      </article>

      <CtaBand
        href={cta}
        title={guide.audience === "business" ? "Defteri dijitale taşı" : "Bunu her ay elle yapma"}
        text={
          guide.audience === "business"
            ? "Kasa, veresiye ve tedarikçi takibini Parakip'e bırak. Ücretsiz başla, kart gerekmez."
            : "Harcamalarını kaydet, Parakip kategorilere ayırsın, bütçeni takip etsin ve ay sonunda özetlesin. Ücretsiz."
        }
      />

      <section className="mx-auto max-w-5xl px-4 pb-16 sm:px-6" aria-labelledby="diger-rehberler">
        <h2 id="diger-rehberler" className="mb-4 text-lg font-bold text-text-primary">Diğer rehberler</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {others.map((g) => (
            <Link key={g.slug} href={`/rehber/${g.slug}`} className="rounded-2xl border border-border bg-surface p-5 hover:border-accent">
              <p className="text-sm font-bold leading-snug text-text-primary">{g.short}</p>
              <p className="mt-1 text-xs text-text-muted">{g.readMinutes} dk okuma</p>
            </Link>
          ))}
        </div>
      </section>

      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "Article",
            headline: guide.title,
            description: guide.description,
            datePublished: guide.published,
            dateModified: guide.updated,
            inLanguage: "tr",
            mainEntityOfPage: absoluteUrl(page),
            image: absoluteUrl(`${page}/opengraph-image`),
            author: { "@type": "Organization", name: "Parakip", url: absoluteUrl("/") },
            publisher: { "@type": "Organization", name: "Parakip", logo: { "@type": "ImageObject", url: absoluteUrl("/brand/icon-512.png") } },
          },
          breadcrumbJsonLd([
            { name: "Rehber", path: "/rehber" },
            { name: guide.short, path: page },
          ]),
        ]}
      />
    </MarketingShell>
  );
}
