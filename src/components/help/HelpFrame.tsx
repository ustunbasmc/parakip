import Link from "next/link";
import type { ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import { MarketingShell } from "@/components/marketing/MarketingShell";

/**
 * Yardım merkezi çerçevesi: oturum açık kullanıcı uygulamanın içindeki
 * görünümü (AppShell), oturumsuz ziyaretçi tanıtım sitesinin çerçevesini
 * görür. İçerik aynıdır; aynı adres iki ayrı içerik yayınlamaz.
 */
export function HelpFrame({
  signedIn,
  title,
  parentHref,
  showTitle = true,
  children,
}: {
  signedIn: boolean;
  title: string;
  parentHref: string;
  /** Oturumsuz görünümde sayfa başlığı (h1) gösterilsin mi (makale kendi h1'ini taşır). */
  showTitle?: boolean;
  children: ReactNode;
}) {
  if (signedIn) {
    return (
      <AppShell variant="subpage" title={title} parentHref={parentHref}>
        {children}
      </AppShell>
    );
  }
  return (
    <MarketingShell>
      <div className="mx-auto w-full max-w-3xl px-4 pb-16 pt-6 sm:px-6">
        <nav aria-label="Konum" className="mb-4 flex flex-wrap items-center gap-1.5 text-xs text-text-muted">
          <Link href="/" className="hover:text-text-primary">
            Ana sayfa
          </Link>
          <span aria-hidden="true">/</span>
          <Link href="/help" className="hover:text-text-primary">
            Yardım merkezi
          </Link>
        </nav>
        {showTitle ? <h1 className="mb-4 text-3xl font-extrabold tracking-tight text-text-primary">{title}</h1> : null}
        {children}
      </div>
    </MarketingShell>
  );
}

/** Oturumsuz ziyaretçiye destek talebi yerine gösterilen giriş çağrısı. */
export function HelpSignInPrompt({ next = "/support/new" }: { next?: string }) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-2xl border border-border bg-surface p-4">
      <p className="text-sm font-semibold text-text-primary">Sorunun çözülmedi mi?</p>
      <p className="text-xs text-text-muted">Destek talebi oluşturmak için hesabına giriş yap; ekibimiz uygulama içinden yanıt verir.</p>
      <div className="mt-1 flex flex-wrap gap-2">
        <Link href={`/sign-in?next=${encodeURIComponent(next)}`} className="rounded-full bg-accent px-4 py-2 text-xs font-bold text-text-on-accent">
          Giriş yap ve yaz
        </Link>
        <Link href="/sign-up" className="rounded-full border border-border px-4 py-2 text-xs font-bold text-text-primary">
          Ücretsiz hesap aç
        </Link>
      </div>
    </div>
  );
}
