"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { buildOfflineSnapshot } from "@/lib/offline/buildSnapshot";
import {
  clearOfflineSnapshots,
  isOfflineSnapshotEnabled,
  readOfflineSnapshot,
  saveOfflineSnapshot,
} from "@/lib/offline/snapshotStore";

/** En sık bu aralıkla yenilenir (her ekran geçişinde değil). */
const MIN_INTERVAL_MS = 3 * 60 * 1000;
let inFlight = false;

/**
 * Oturum açık ekranlarda (AppShell) arka planda çalışır: çevrimiçiyken
 * çevrimdışı özet kopyayı günceller. Ekranın yüklenmesini beklemez,
 * tarayıcı boşta kalınca başlar; hata olursa sessizce vazgeçer.
 */
export function OfflineSnapshotSync() {
  useEffect(() => {
    let cancelled = false;

    async function sync() {
      if (cancelled || inFlight || !navigator.onLine) return;
      if (!isOfflineSnapshotEnabled()) {
        await clearOfflineSnapshots();
        return;
      }
      inFlight = true;
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getSession();
        const userId = data.session?.user.id;
        if (!userId) {
          await clearOfflineSnapshots();
          return;
        }
        const existing = await readOfflineSnapshot(userId);
        if (existing && Date.now() - new Date(existing.savedAt).getTime() < MIN_INTERVAL_MS) return;
        const snapshot = await buildOfflineSnapshot(supabase, userId);
        if (!cancelled && isOfflineSnapshotEnabled()) await saveOfflineSnapshot(snapshot);
      } catch {
        // Kopya alınamazsa bir sonraki fırsatta yeniden denenir.
      } finally {
        inFlight = false;
      }
    }

    const w = window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number };
    const start = () => (w.requestIdleCallback ? w.requestIdleCallback(() => void sync(), { timeout: 5000 }) : window.setTimeout(() => void sync(), 2000));
    start();
    window.addEventListener("online", start);
    return () => {
      cancelled = true;
      window.removeEventListener("online", start);
    };
  }, []);

  return null;
}
