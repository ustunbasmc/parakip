"use client";

import { useEffect } from "react";

/**
 * Elle yeniden dene / uygulamaya dön. Bağlantı geri gelince ana sayfaya
 * kendiliğinden geçer (çevrimdışı sayfası yalnızca bağlantı yokken
 * gösterilir; /offline'da kalmanın anlamı yok).
 */
export function RetryButton({ compact = false, label = "Tekrar dene" }: { compact?: boolean; label?: string }) {
  useEffect(() => {
    const onOnline = () => window.location.replace("/");
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);

  return (
    <button
      type="button"
      onClick={() => window.location.replace("/")}
      className={`rounded-full bg-accent font-bold text-text-on-accent ${compact ? "h-9 px-4 text-xs" : "h-11 px-6 text-sm"}`}
    >
      {label}
    </button>
  );
}
