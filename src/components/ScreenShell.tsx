"use client";

import type { ReactNode } from "react";
import { BackButton } from "./BackButton";

interface ScreenShellProps {
  children: ReactNode;
  /** Alt kısımda sabit kalan birincil eylem alanı (buton vb.). */
  footer?: ReactNode;
  showBack?: boolean;
  backFallbackHref?: string;
  title?: string;
}

/**
 * KLAVYE GÜVENLİĞİ: min-h-dvh (dynamic viewport height) kullanılır, 100vh
 * DEĞİL. Mobilde klavye açıldığında dvh gerçek görünür alanı yansıtacak
 * şekilde küçülür; böylece footer'daki buton klavyenin ALTINA gizlenmez,
 * içerik alanı doğal olarak kayar (position:fixed footer'ların mobilde
 * sık yaşadığı "klavye üstünde asılı kalma" sorunu oluşmaz). footer,
 * normal akış içinde "sticky bottom-0" — gerçek fixed değil.
 */
export function ScreenShell({
  children,
  footer,
  showBack = true,
  backFallbackHref,
  title,
}: ScreenShellProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="flex items-center gap-2 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2">
        {showBack ? <BackButton fallbackHref={backFallbackHref} /> : <div className="h-11 w-11" />}
        {title ? <h1 className="text-base font-semibold text-text-primary">{title}</h1> : null}
      </header>

      <main className="flex flex-1 flex-col overflow-y-auto px-5 pb-6">{children}</main>

      {footer ? (
        <footer className="sticky bottom-0 border-t border-border bg-bg px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {footer}
        </footer>
      ) : null}
    </div>
  );
}
