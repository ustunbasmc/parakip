"use client";

import { useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { ErrorBanner } from "@/components/ErrorBanner";
import { reportClientError } from "@/lib/errors/reportClient";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard hatası:", error);
    reportClientError(error, "home/error");
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
