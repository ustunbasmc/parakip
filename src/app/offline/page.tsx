import { RetryButton } from "./RetryButton";

export const metadata = { title: "Çevrimdışı | Parakip", robots: { index: false, follow: false } };

/**
 * Service worker'ın ağ yokken gösterdiği sayfa (bkz. public/sw.js). Statik
 * üretilir ve HİÇBİR kullanıcı verisi içermez — bu yüzden cihazda
 * saklanması güvenlidir.
 */
export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-1 flex-col items-center justify-center gap-6 bg-bg px-6 py-12 text-center">
      {/* next/image yerine düz img: ikon service worker önbelleğinde (bkz. public/sw.js). */}
      <span className="inline-flex items-center gap-2.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/icon-192.png" alt="" width={34} height={34} className="rounded-[9px]" />
        <span className="text-[1.35rem] font-extrabold tracking-tight text-text-primary">parakip</span>
      </span>
      <div className="flex max-w-sm flex-col gap-2">
        <h1 className="text-xl font-extrabold text-text-primary">İnternet bağlantısı yok</h1>
        <p className="text-sm text-text-secondary">
          Parakip&apos;teki bilgilerin güvende; hesapların ve işlemlerin sunucuda saklanıyor. Bağlantın geri geldiğinde
          kaldığın yerden devam edebilirsin.
        </p>
      </div>
      <RetryButton />
      <p className="text-xs text-text-muted">Güvenliğin için finansal verilerin bu cihazda çevrimdışı saklanmaz.</p>
    </main>
  );
}
