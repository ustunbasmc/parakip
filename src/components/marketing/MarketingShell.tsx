import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/Logo";
import { InstallAppButton } from "@/components/InstallAppButton";

const NAV = [
  { href: "/ev-butcesi", label: "Ev bütçesi" },
  { href: "/esnaf-gelir-gider", label: "Esnaf" },
  { href: "/#fiyatlandirma", label: "Fiyatlar" },
  { href: "/rehber", label: "Rehber" },
  { href: "/help", label: "Yardım" },
];

const FOOTER: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "Parakip",
    links: [
      { href: "/", label: "Ana sayfa" },
      { href: "/ev-butcesi", label: "Aile bütçesi" },
      { href: "/esnaf-gelir-gider", label: "Esnaf gelir-gider" },
      { href: "/#fiyatlandirma", label: "Fiyatlar" },
    ],
  },
  {
    title: "Kaynaklar",
    links: [
      { href: "/rehber", label: "Rehberler" },
      { href: "/butce-sablonu", label: "Ücretsiz bütçe şablonu" },
      { href: "/help", label: "Yardım merkezi" },
    ],
  },
  {
    title: "Yasal",
    links: [
      { href: "/legal/gizlilik-politikasi", label: "Gizlilik Politikası" },
      { href: "/legal/kvkk-aydinlatma-metni", label: "KVKK Aydınlatma Metni" },
      { href: "/legal/kullanim-kosullari", label: "Kullanım Koşulları" },
      { href: "/legal/cerez-politikasi", label: "Çerez Politikası" },
      { href: "/legal/mesafeli-satis-sozlesmesi", label: "Mesafeli Satış Sözleşmesi" },
      { href: "/legal/iptal-iade-politikasi", label: "İptal ve İade Politikası" },
    ],
  },
];

/**
 * Herkese açık sayfaların (tanıtım, iniş sayfaları, rehber, yardım) ortak
 * çerçevesi. Sunucu bileşenidir; mobil menü JS gerektirmez (<details>).
 */
export function MarketingShell({
  children,
  signupHref = "/sign-up",
  isSignedIn = false,
}: {
  children: ReactNode;
  signupHref?: string;
  /** Oturum açık kullanıcıya "Giriş yap / Ücretsiz başla" yerine uygulamaya dönüş gösterilir. */
  isSignedIn?: boolean;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="sticky top-0 z-30 border-b border-border bg-bg/90 backdrop-blur print:hidden">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/" aria-label="Parakip ana sayfa" className="shrink-0">
            <Logo />
          </Link>
          <nav className="hidden items-center gap-6 lg:flex" aria-label="Ana menü">
            {NAV.map((l) => (
              <Link key={l.href} href={l.href} className="text-sm font-medium text-text-secondary hover:text-text-primary">
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <InstallAppButton variant="compact" />
            {isSignedIn ? (
              <Link href="/home" className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-text-on-accent">
                Uygulamaya git
              </Link>
            ) : (
              <>
                <Link href="/sign-in" className="hidden rounded-full px-3 py-2 text-sm font-semibold text-text-secondary hover:text-text-primary sm:block">
                  Giriş yap
                </Link>
                <Link href={signupHref} className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-text-on-accent">
                  Ücretsiz başla
                </Link>
              </>
            )}
            <details className="group relative lg:hidden">
              <summary
                className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-full border border-border text-text-secondary [&::-webkit-details-marker]:hidden"
                aria-label="Menü"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </summary>
              <nav
                className="absolute right-0 top-11 flex w-56 flex-col rounded-2xl border border-border bg-surface p-2 shadow-xl"
                aria-label="Mobil menü"
              >
                {NAV.map((l) => (
                  <Link key={l.href} href={l.href} className="rounded-xl px-3 py-2.5 text-sm font-semibold text-text-primary hover:bg-surface-muted">
                    {l.label}
                  </Link>
                ))}
                {!isSignedIn ? (
                  <Link href="/sign-in" className="rounded-xl px-3 py-2.5 text-sm font-semibold text-text-secondary hover:bg-surface-muted">
                    Giriş yap
                  </Link>
                ) : null}
              </nav>
            </details>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border bg-surface/40 print:hidden">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-[1.2fr_1fr_1fr_1.3fr]">
          <div className="flex flex-col gap-3">
            <Logo />
            <p className="max-w-xs text-sm text-text-muted">Evinin ve işinin parası tek yerde. Ücretsiz başla, kart gerekmez.</p>
          </div>
          {FOOTER.map((col) => (
            <div key={col.title}>
              <p className="mb-3 text-xs font-bold uppercase tracking-wide text-text-muted">{col.title}</p>
              <ul className="flex flex-col gap-2">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-sm text-text-secondary hover:text-text-primary">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="border-t border-border px-4 py-5 text-center text-xs text-text-muted">© {new Date().getFullYear()} Parakip</p>
      </footer>
    </div>
  );
}

/** Sayfa bölümü başlığı (ortak tipografi). */
export function SectionHeading({ eyebrow, title, description, id }: { eyebrow?: string; title: string; description?: ReactNode; id?: string }) {
  return (
    <div className="mx-auto mb-10 max-w-2xl text-center">
      {eyebrow ? <p className="mb-2 text-xs font-bold uppercase tracking-wide text-accent">{eyebrow}</p> : null}
      <h2 id={id} className="text-2xl font-extrabold tracking-tight text-text-primary sm:text-3xl">
        {title}
      </h2>
      {description ? <p className="mt-3 text-text-secondary">{description}</p> : null}
    </div>
  );
}
