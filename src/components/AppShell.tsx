"use client";

import type { ReactNode } from "react";
import { BackButton } from "./BackButton";
import { Suspense } from "react";
import { BottomNav } from "./BottomNav";
import { Sidebar } from "./Sidebar";
import { Logo } from "./Logo";
import { InstallAppButton } from "./InstallAppButton";

interface AppShellProps {
  children: ReactNode;
  /** "root": geri butonu yok, sol üstte marka simgesi (ör. Ana Sayfa).
   *  "subpage": geri butonlu, bir alt seviye ekran (ör. Ayarlar). */
  variant?: "root" | "subpage";
  title?: string;
  backFallbackHref?: string;
  /** Kaydedilmemiş veri varken geri çıkışını onaylatmak için (bkz. BackButton). */
  backGuard?: () => boolean;
  /** Başlığın yanına, sağa hizalı ekstra içerik (ör. alan seçici). */
  headerEnd?: ReactNode;
  /** Müşteriler/Tedarikçiler gibi yalnızca İşletme'ye özel menü öğelerini
   * göstermek/gizlemek için — bilinmiyorsa (ör. alan-bağımsız ekranlar)
   * bu öğeler GÜVENLİ TARAFTA kalınarak gizlenir. */
  activeSpaceType?: "home" | "business";
}

/**
 * Kalıcı navigasyonlu, oturum sonrası (dashboard/ayarlar gibi) ekranlar
 * için ortak kabuk. ScreenShell (onboarding/auth akışı) burada
 * KULLANILMAZ — o, "tek yönlü akış + sticky footer buton" için
 * tasarlanmıştı; bu ekranlar kalıcı, çok yönlü gezinme gerektiriyor.
 *
 * MOBİL/MASAÜSTÜ AYRI DENEYİM (aynı veri/mantık, yalnızca kabuk
 * değişir): mobilde sol sidebar YOK, alt navigasyon VAR; masaüstünde
 * (md: ve üstü) sol sabit sidebar VAR, alt navigasyon GİZLİ. İçerik
 * genişliği de buna göre uyarlanır — mobilde tam genişlik, masaüstünde
 * sidebar'ın yanında daha geniş (max-w-4xl) ama aşırı gerilmeden
 * okunabilir bir sütun.
 */
export function AppShell({
  children,
  variant = "root",
  title,
  backFallbackHref = "/home",
  backGuard,
  headerEnd,
  activeSpaceType,
}: AppShellProps) {
  return (
    <div className="flex min-h-dvh bg-bg md:items-stretch">
      <Suspense fallback={<div className="hidden w-64 shrink-0 md:block" />}>
        <Sidebar activeSpaceType={activeSpaceType} />
      </Suspense>

      <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2 md:px-8 md:pt-6">
          {variant === "subpage" ? (
            <>
              <BackButton fallbackHref={backFallbackHref} guard={backGuard} />
              {title ? <h1 className="text-base font-semibold text-text-primary md:text-lg">{title}</h1> : null}
            </>
          ) : title ? (
            <h1 className="text-lg font-bold text-text-primary">{title}</h1>
          ) : (
            <Logo withWordmark={false} className="scale-90 md:hidden" />
          )}
          <div className="ml-auto flex items-center gap-2">
            <InstallAppButton variant="compact" />
            {headerEnd}
          </div>
        </header>

        <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col overflow-y-auto px-4 pb-6 md:max-w-none md:px-8 md:pb-10 xl:px-12 2xl:max-w-[100rem]">
          {children}
        </main>

        <Suspense fallback={<div className="h-[3.75rem] shrink-0 md:hidden" />}>
          <BottomNav activeSpaceType={activeSpaceType} />
        </Suspense>
      </div>
    </div>
  );
}
