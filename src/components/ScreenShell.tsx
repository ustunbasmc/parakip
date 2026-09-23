"use client";

import type { ReactNode } from "react";
import { AuthShell } from "@/components/auth/AuthShell";

interface ScreenShellProps {
  children: ReactNode;
  /** Alt kısımda sabit kalan birincil eylem alanı (buton vb.). */
  footer?: ReactNode;
  showBack?: boolean;
  /** Geri butonunun gideceği ebeveyn rota (akış içindeki bir önceki adım). */
  parentHref?: string;
}

/**
 * Tek yönlü akış ekranlarının (onboarding) kabuğu. Giriş/kayıt ekranlarıyla
 * AYNI düzeni kullanır (bkz. AuthShell): mobilde form öncelikli sade
 * görünüm + sticky buton (klavye güvenli, min-h-dvh), masaüstünde solda
 * marka paneli + sağda kart — onboarding masaüstünde dar bir mobil form
 * gibi görünmez. Kod tekrarı olmasın diye doğrudan AuthShell'e devreder.
 */
export function ScreenShell({ children, footer, showBack = true, parentHref }: ScreenShellProps) {
  return (
    <AuthShell footer={footer} showBack={showBack} parentHref={parentHref}>
      {children}
    </AuthShell>
  );
}
