"use client";

import { useRouter } from "next/navigation";

/**
 * Her ekranda görünür geri butonu (belge madde 3/14.7 gereği). router.back()
 * tarayıcı geçmişini kullanır — bu sayede cihazın kendi geri tuşu/gesture'ı
 * ile de TUTARLI davranır (aynı history mekanizması); ekranlar arası geçiş
 * router.push ile yapıldığı sürece (replace değil) her iki yol da aynı
 * sonucu üretir.
 */
export function BackButton({
  fallbackHref,
  label = "Geri",
  guard,
}: {
  /** router.back() ile geri gidecek bir geçmiş yoksa (ör. doğrudan link ile
   * açılmış bir sayfa) kullanılacak yedek hedef. */
  fallbackHref?: string;
  label?: string;
  /**
   * Verilirse, navigasyondan ÖNCE çağrılır. false dönerse navigasyon
   * iptal edilir — kaydedilmemiş form verisi varken çıkışı onaylatmak
   * için kullanılır (bkz. useUnsavedChangesGuard).
   */
  guard?: () => boolean;
}) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => {
        if (guard && !guard()) return;
        if (typeof window !== "undefined" && window.history.length > 1) {
          router.back();
        } else if (fallbackHref) {
          router.push(fallbackHref);
        } else {
          router.back();
        }
      }}
      aria-label={label}
      className="inline-flex h-11 w-11 -ml-2 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-surface-muted active:bg-surface-muted"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M15 18l-6-6 6-6"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
