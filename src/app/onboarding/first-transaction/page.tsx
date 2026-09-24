"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ScreenShell } from "@/components/ScreenShell";
import { Button } from "@/components/Button";
import { parsePlanKey, planPeriod, planSpaceType } from "@/lib/plans/planParam";

function FirstTransactionPrompt() {
  const router = useRouter();
  // Tanıtım sayfasında plan seçildiyse kurulum sonunda o planın ödeme ekranı
  // önerilir; ödemeye zorlanmaz ("Şimdilik ücretsiz devam et").
  const plan = parsePlanKey(useSearchParams().get("plan"));
  const planLabel = plan
    ? `${planSpaceType(plan) === "home" ? "Ev Premium" : "İşletme Premium"} (${planPeriod(plan) === "yearly" ? "yıllık" : "aylık"})`
    : null;

  return (
    <ScreenShell
      parentHref="/onboarding/space-type"
      footer={
        plan ? (
          <div className="flex flex-col gap-2">
            <Button onClick={() => router.push(`/settings/plan?plan=${plan}`)}>{planLabel} ile devam et</Button>
            <Button variant="ghost" onClick={() => router.push("/home")}>
              Şimdilik ücretsiz devam et
            </Button>
          </div>
        ) : (
          <Button onClick={() => router.push("/home")}>Ana ekrana git</Button>
        )
      }
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
          {plan
            ? `Seçtiğin ${planLabel} planına şimdi geçebilir ya da önce ücretsiz planla deneyebilirsin.`
            : "Sıradaki adım ilk gelir veya gider kaydını eklemek. Ana ekrandan istediğin zaman başlayabilirsin."}
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
