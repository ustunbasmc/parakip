"use client";

import type { ReactNode } from "react";
import { BackButton } from "@/components/BackButton";
import { Logo } from "@/components/Logo";
import { AuthBrandPanel } from "./AuthBrandPanel";

interface AuthShellProps {
  children: ReactNode;
  /** Mobilde altta sabit, masaüstünde formun hemen altında duran birincil eylem. */
  footer?: ReactNode;
  /** Geri butonunun gideceği ebeveyn rota (akıştaki bir önceki adım). */
  parentHref?: string;
  showBack?: boolean;
}

/**
 * Giriş / kayıt / şifre sıfırlama / e-posta doğrulama ekranlarının ortak
 * kabuğu. Mobil ve masaüstü AYRI düşünülmüştür:
 *
 * - Mobil (lg altı): form öncelikli sade düzen — üstte geri butonu ve
 *   küçük marka, içerik, altta sticky birincil buton (ScreenShell ile aynı
 *   klavye güvenliği: min-h-dvh + sticky footer, fixed DEĞİL).
 * - Masaüstü (lg ve üstü): iki kolon — solda marka/tanıtım paneli, sağda
 *   makul genişlikte bir kart içinde form; buton formun altında, akış
 *   içinde durur.
 *
 * Form mantığı (doğrulama, loading, hata/başarı) sayfalarda kalır; bu
 * bileşen yalnızca yerleşimi değiştirir.
 */
export function AuthShell({ children, footer, parentHref, showBack = true }: AuthShellProps) {
  return (
    <div className="min-h-dvh shrink-0 bg-bg lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <AuthBrandPanel />

      <div className="flex min-h-dvh min-w-0 flex-col lg:items-center lg:justify-center lg:px-10 lg:py-10">
        <div className="flex min-h-dvh w-full min-w-0 flex-col md:mx-auto md:max-w-[36rem] lg:min-h-0 lg:max-w-[30rem]">
          <header className="flex items-center gap-2 px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))] lg:px-0 lg:pt-0">
            {showBack ? <BackButton href={parentHref} /> : <div className="h-11 w-11" />}
            <span className="ml-auto lg:hidden">
              <Logo />
            </span>
          </header>

          <main className="flex min-w-0 flex-1 flex-col px-5 pb-6 lg:flex-none lg:rounded-3xl lg:border lg:border-border lg:bg-surface lg:p-8 lg:shadow-[var(--shadow-elevated)]">
            {children}
            {footer ? <div className="mt-6 hidden lg:block">{footer}</div> : null}
          </main>

          {footer ? (
            <footer className="sticky bottom-0 border-t border-border bg-bg px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 lg:hidden">
              {footer}
            </footer>
          ) : null}
        </div>
      </div>
    </div>
  );
}
