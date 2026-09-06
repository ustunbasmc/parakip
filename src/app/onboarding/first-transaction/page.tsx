"use client";

import { Suspense } from "react";
import { useRouter } from "next/navigation";
import { ScreenShell } from "@/components/ScreenShell";
import { Button } from "@/components/Button";

function FirstTransactionPrompt() {
  const router = useRouter();

  return (
    <ScreenShell
      backFallbackHref="/onboarding/space-type"
      footer={<Button onClick={() => router.push("/home")}>Ana ekrana git</Button>}
    >
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <div
          aria-hidden="true"
          className="flex h-16 w-16 items-center justify-center rounded-full bg-accent-soft text-3xl"
        >
          🎉
        </div>
        <h1 className="text-2xl font-bold text-text-primary">Kurulum tamamlandı</h1>
        <p className="max-w-xs text-text-secondary">
          Sıradaki adım ilk gelir veya gider kaydını eklemek. Ana ekrandan
          istediğin zaman başlayabilirsin.
        </p>
      </div>
    </ScreenShell>
  );
}

export default function FirstTransactionPage() {
  return (
    <Suspense fallback={null}>
      <FirstTransactionPrompt />
    </Suspense>
  );
}
