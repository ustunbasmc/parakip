"use client";

import { useRouter } from "next/navigation";
import { ScreenShell } from "@/components/ScreenShell";

const OPTIONS = [
  {
    type: "home" as const,
    title: "Ev",
    description: "Kişisel ve aile finansını takip et.",
    href: "/onboarding/create-space?type=home",
  },
  {
    type: "business" as const,
    title: "İşletme",
    description: "Küçük işletmenin gelir-giderini yönet.",
    href: "/onboarding/create-space?type=business",
  },
  {
    type: "both" as const,
    title: "İkisini de kullanacağım",
    description: "Önce Ev, sonra İşletme alanını birlikte kuralım.",
    href: "/onboarding/create-space?type=home&then=business",
  },
];

export default function SpaceTypePage() {
  const router = useRouter();

  return (
    <ScreenShell backFallbackHref="/">
      <div className="flex flex-1 flex-col gap-6 pt-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Nasıl kullanacaksın?</h1>
          <p className="mt-1 text-text-secondary">
            İstediğin zaman diğerini de ekleyebilirsin.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {OPTIONS.map((option) => (
            <button
              key={option.type}
              type="button"
              onClick={() => router.push(option.href)}
              className="flex flex-col gap-1 rounded-2xl border border-border bg-surface p-5 text-left transition-colors active:bg-surface-muted"
            >
              <span className="text-lg font-semibold text-text-primary">{option.title}</span>
              <span className="text-sm text-text-secondary">{option.description}</span>
            </button>
          ))}
        </div>
      </div>
    </ScreenShell>
  );
}
