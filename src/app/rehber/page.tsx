import type { Metadata } from "next";
import Link from "next/link";
import { GUIDES } from "@/content/rehber";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { signupHref } from "@/lib/marketing/attribution";

export const metadata: Metadata = {
  title: "Rehber — Bütçe, Borç ve Birikim Rehberleri | Parakip",
  description:
    "Aile bütçesi nasıl yapılır, esnaf gelir-gider defteri nasıl tutulur, kredi kartı borcu nasıl yönetilir, acil durum fonu ne kadar olmalı? Sade ve uygulanabilir rehberler.",
  alternates: { canonical: "/rehber" },
  openGraph: {
    title: "Parakip Rehber: bütçe, borç ve birikim",
    description: "Sade ve uygulanabilir para yönetimi rehberleri.",
    url: "/rehber",
    siteName: "Parakip",
    locale: "tr_TR",
    type: "website",
  },
};

const fmtDate = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export default function RehberPage() {
  return (
    <MarketingShell signupHref={signupHref({ page: "/rehber" })}>
      <div className="mx-auto max-w-5xl px-4 pb-20 pt-10 sm:px-6 sm:pt-14">
        <p className="text-xs font-bold uppercase tracking-wide text-accent">Rehber</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-text-primary sm:text-4xl">Bütçe, borç ve birikim rehberleri</h1>
        <p className="mt-3 max-w-2xl text-text-secondary">
          Para yönetimini karmaşık terimler olmadan, adım adım anlatan rehberler. Genel bilgilendirme amaçlıdır; yatırım tavsiyesi
          değildir.
        </p>

        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {GUIDES.map((g) => (
            <Link key={g.slug} href={`/rehber/${g.slug}`} className="flex flex-col gap-2 rounded-3xl border border-border bg-surface p-6 transition-colors hover:border-accent">
              <span className="text-xs font-bold text-accent">{g.audience === "business" ? "İşletme" : "Ev ve aile"} · {g.readMinutes} dk okuma</span>
              <h2 className="text-lg font-bold leading-snug text-text-primary">{g.title}</h2>
              <p className="text-sm text-text-secondary">{g.description}</p>
              <span className="mt-auto pt-2 text-xs text-text-muted">Güncelleme: {fmtDate.format(new Date(`${g.updated}T00:00:00Z`))}</span>
            </Link>
          ))}
          <Link href="/butce-sablonu" className="flex flex-col gap-2 rounded-3xl border border-dashed border-accent/60 bg-accent-soft p-6 transition-colors hover:border-accent md:col-span-2">
            <span className="text-xs font-bold text-accent">Ücretsiz kaynak</span>
            <h2 className="text-lg font-bold text-text-primary">Aylık bütçe şablonu: tarayıcıda doldur veya Excel olarak indir</h2>
            <p className="text-sm text-text-secondary">Gelir ve giderlerini gir; ihtiyaç, istek ve birikim dağılımın ile kalan tutar anında hesaplansın.</p>
          </Link>
        </div>
      </div>
    </MarketingShell>
  );
}
