import Link from "next/link";
import { Logo } from "@/components/Logo";

/**
 * Tüm yasal/hukuki sayfalar için ortak, sade kabuk — oturum GEREKTİRMEZ
 * (bkz. proxy.ts PUBLIC_PATHS), herkese açıktır.
 */
export function LegalPageShell({
  title,
  lastUpdated,
  children,
}: {
  title: string;
  lastUpdated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-bg">
      <header className="border-b border-border px-5 py-4">
        <Link href="/" className="inline-flex">
          <Logo />
        </Link>
      </header>
      <main className="mx-auto max-w-2xl px-5 py-8 sm:py-12">
        <Link href="/" className="text-sm font-semibold text-accent">
          ← Ana sayfaya dön
        </Link>
        <h1 className="mt-4 text-2xl font-extrabold text-text-primary sm:text-3xl">{title}</h1>
        <p className="mt-1 text-sm text-text-muted">Son güncelleme: {lastUpdated}</p>
        <div className="mt-8 flex flex-col gap-5 text-[0.9375rem] leading-relaxed text-text-secondary">
          {children}
        </div>
      </main>
    </div>
  );
}
