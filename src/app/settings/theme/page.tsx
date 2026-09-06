"use client";

import { AppShell } from "@/components/AppShell";
import { useThemePreference } from "@/lib/theme/ThemeSync";
import type { ThemePreference } from "@/lib/api/onboarding-rpc";

const OPTIONS: { value: ThemePreference; label: string; description: string }[] = [
  { value: "light", label: "Gündüz Modu", description: "Açık, ferah görünüm." },
  { value: "dark", label: "Gece Modu", description: "Koyu gece mavisi ve turkuaz." },
  { value: "system", label: "Sistem", description: "Cihazının temasını izler." },
];

export default function ThemeSettingsPage() {
  const { theme, changeTheme, saving } = useThemePreference();

  return (
    <AppShell variant="subpage" backFallbackHref="/home" title="Görünüm">
      <div className="flex flex-col gap-3 pt-4">
        {OPTIONS.map((option) => {
          const selected = theme === option.value;
          return (
            <button
              key={option.value}
              type="button"
              disabled={saving}
              onClick={() => changeTheme(option.value)}
              aria-pressed={selected}
              className={`flex items-center justify-between rounded-2xl border p-4 text-left transition-colors ${
                selected
                  ? "border-accent bg-accent-soft"
                  : "border-border bg-surface active:bg-surface-muted"
              }`}
            >
              <span>
                <span className="block font-semibold text-text-primary">{option.label}</span>
                <span className="block text-sm text-text-secondary">{option.description}</span>
              </span>
              {selected ? (
                <span
                  aria-hidden="true"
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-text-on-accent"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M20 6L9 17l-5-5"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </AppShell>
  );
}
