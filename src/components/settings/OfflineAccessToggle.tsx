"use client";

import { useState, useSyncExternalStore } from "react";
import { isOfflineSnapshotEnabled, setOfflineSnapshotEnabled } from "@/lib/offline/snapshotStore";

/**
 * "Çevrimdışı erişim" tercihi (bu cihaz için). Kapatılınca cihazdaki özet
 * kopya hemen silinir ve yenisi alınmaz. Tercih finansal veri değildir;
 * yalnızca açık/kapalı bilgisi tarayıcıda tutulur.
 */
const listeners = new Set<() => void>();
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function OfflineAccessToggle() {
  // Sunucuda (ve hidrasyon anında) null: tercih yalnızca tarayıcıda okunabilir.
  const enabled = useSyncExternalStore(subscribe, isOfflineSnapshotEnabled, () => null);
  const [message, setMessage] = useState<string | null>(null);

  async function toggle() {
    const next = !enabled;
    await setOfflineSnapshotEnabled(next);
    listeners.forEach((cb) => cb());
    setMessage(
      next
        ? "Açıldı. Uygulamayı internetliyken kullandığında özet bilgilerin bu cihaza kaydedilecek."
        : "Kapatıldı. Bu cihazdaki çevrimdışı kopya silindi."
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor="offline-access" className="min-w-0 flex-1 cursor-pointer">
          <span className="block text-sm font-semibold text-text-secondary">Çevrimdışı erişim (bu cihaz)</span>
          <span className="mt-0.5 block text-xs text-text-muted">
            İnternet yokken bakiyelerini, son işlemlerini, bütçelerini ve açık borç/alacaklarını salt okunur görebilmen için bu
            cihazda özet bir kopya tutulur. Çıkış yapınca silinir. Ortak kullanılan bir cihazdaysan kapatmanı öneririz.
          </span>
        </label>
        <button
          id="offline-access"
          type="button"
          role="switch"
          aria-checked={enabled ?? true}
          disabled={enabled === null}
          onClick={toggle}
          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-60 ${enabled ?? true ? "bg-accent" : "bg-border-strong"}`}
        >
          <span
            aria-hidden="true"
            className={`absolute left-0 top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
              enabled ?? true ? "translate-x-[22px]" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>
      {message ? (
        <p role="status" className="text-xs font-semibold text-success">
          {message}
        </p>
      ) : null}
    </div>
  );
}
