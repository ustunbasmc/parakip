import { OfflineView } from "./OfflineView";

export const metadata = { title: "Çevrimdışı | Parakip", robots: { index: false, follow: false } };

/**
 * Service worker'ın ağ yokken gösterdiği sayfa (bkz. public/sw.js). Sayfanın
 * KENDİSİ statiktir ve kullanıcı verisi içermez; finansal özet yalnızca
 * tarayıcıda, cihazdaki çevrimdışı kopyadan (IndexedDB) okunur ve oturum
 * sahibi doğrulanmadan gösterilmez (bkz. lib/offline/snapshotStore.ts).
 */
export default function OfflinePage() {
  return <OfflineView />;
}
