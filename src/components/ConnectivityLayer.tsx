"use client";

import { useEffect } from "react";
import { useOffline } from "next/offline";

/**
 * Kök düzende bir kez render edilir:
 *  1. Üretimde service worker'ı kaydeder (bkz. public/sw.js — yalnızca
 *     statik dosyalar ve çevrimdışı sayfası saklanır, finansal veri değil).
 *  2. Bağlantı koptuğunda üstte bir uyarı bandı gösterir. Bekleyen gezinti ve
 *     kayıt işlemleri Next.js (experimental.useOffline) tarafından
 *     bağlantı gelince kendiliğinden yeniden denenir.
 */
export function ConnectivityLayer() {
  const offline = useOffline();

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        // Kayıt başarısız olursa uygulama normal (çevrimiçi) çalışmaya devam eder.
      });
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  if (!offline) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex justify-center px-3 pt-[max(0.5rem,env(safe-area-inset-top))] print:hidden"
    >
      <p className="pointer-events-auto flex items-center gap-2 rounded-full bg-text-primary px-4 py-2 text-xs font-semibold text-bg shadow-lg">
        <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-warning" aria-hidden="true" />
        <span>İnternet bağlantısı yok</span>
        {/* Tam sayfa geçiş: service worker çevrimdışı görünümü önbellekten verir. */}
        <button type="button" onClick={() => window.location.assign("/offline")} className="font-bold text-accent underline underline-offset-2">
          Kayıtlı verileri gör
        </button>
      </p>
    </div>
  );
}
