"use client";

import { useEffect } from "react";

/** Elle yeniden dene; bağlantı geri gelince sayfayı kendiliğinden yeniler. */
export function RetryButton() {
  useEffect(() => {
    const onOnline = () => window.location.reload();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);

  return (
    <button
      type="button"
      onClick={() => window.location.reload()}
      className="h-11 rounded-full bg-accent px-6 text-sm font-bold text-text-on-accent"
    >
      Tekrar dene
    </button>
  );
}
