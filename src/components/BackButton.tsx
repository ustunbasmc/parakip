"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getParentHref, withSpaceParam } from "@/lib/navigation/parentRoutes";

/**
 * Her ekranda görünür geri butonu — HİYERARŞİK çalışır: kullanıcıyı
 * tarayıcı geçmişindeki önceki sayfaya değil, ekranın EBEVEYN rotasına
 * götürür (ör. /accounts/123 → /accounts). router.back() KULLANILMAZ;
 * böylece sayfa doğrudan URL ile açılmış olsa bile sonuç aynıdır.
 *
 * Ebeveyn: `href` verilmişse o, verilmemişse merkezi rota tablosu
 * (bkz. lib/navigation/parentRoutes.ts). Cihazın fiziksel geri tuşu bu
 * bileşenden etkilenmez; açık bir modal kendi popstate dinleyicisiyle
 * önce kapanır.
 */
export function BackButton({
  href,
  label = "Geri",
  guard,
}: {
  /** Ebeveyn rota. Verilmezse bulunulan yoldan hesaplanır. */
  href?: string;
  label?: string;
  /**
   * Verilirse, navigasyondan ÖNCE çağrılır. false dönerse navigasyon
   * iptal edilir — kaydedilmemiş form verisi varken çıkışı onaylatmak
   * için kullanılır (bkz. useUnsavedChangesGuard).
   */
  guard?: () => boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const target = href ?? getParentHref(pathname);

  return (
    <Link
      href={target}
      onClick={(e) => {
        e.preventDefault();
        if (guard && !guard()) return;
        // useSearchParams yerine tıklama anında okunur — statik sayfalarda
        // Suspense sınırı gerektirmesin diye.
        router.push(href ? href : withSpaceParam(target, window.location.search));
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
    </Link>
  );
}
