"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/errors/reportClient";

/**
 * Kök düzen dahil her şeyin çöktüğü durumda gösterilen ekran. Global
 * stiller burada yüklenmediği için satır içi stil kullanılır.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportClientError(error, "global-error");
  }, [error]);

  return (
    <html lang="tr">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#0a1120", color: "#e2e8f0" }}>
        <title>Bir sorun oluştu | Parakip</title>
        <main style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 20, margin: 0 }}>Beklenmeyen bir sorun oluştu</h1>
          <p style={{ maxWidth: 360, margin: 0, color: "#94a3b8", fontSize: 14 }}>
            Sorunu kaydettik ve inceleyeceğiz. Verilerin güvende. Sayfayı yeniden yüklemeyi dene.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{ background: "#2dd4bf", color: "#042f2e", border: 0, borderRadius: 999, padding: "10px 22px", fontWeight: 700, cursor: "pointer" }}
          >
            Tekrar dene
          </button>
        </main>
      </body>
    </html>
  );
}
