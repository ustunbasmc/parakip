"use client";

import { useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { ErrorBanner } from "@/components/ErrorBanner";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Beklenmeyen hatayı geliştirici konsoluna da düş (Sentry vb. ileride buraya bağlanabilir).
    console.error("Dashboard hatası:", error);
  }, [error]);

  return (
    <AppShell title="Parakip">
      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-10 text-center">
        <ErrorBanner message="Ana sayfa yüklenirken beklenmeyen bir sorun oluştu." />
        <Button onClick={reset} fullWidth={false}>
          Tekrar dene
        </Button>
      </div>
    </AppShell>
  );
}
