"use client";

import { useState } from "react";
import { InstallInstructionsModal } from "@/components/InstallInstructionsModal";
import { promptInstall, useInstallState } from "@/lib/pwa/install";

/**
 * "Ana ekrana ekle" — platforma göre davranır:
 * - Android/Chrome (ve destekleyen diğer tarayıcılar): `beforeinstallprompt`
 *   yakalanmışsa tıklayınca NATİF kurulum diyaloğunu açar.
 * - iOS Safari: native bir install API'si YOKTUR — tıklayınca "Paylaş >
 *   Ana Ekrana Ekle" adımlarını gösteren bir talimat modalı açılır.
 * - Uygulama zaten yüklü/standalone modda çalışıyorsa (kullanıcı zaten
 *   ana ekrandan açmış) buton HİÇ gösterilmez.
 * Durum tek kaynaktan gelir: lib/pwa/install.ts.
 */
export function InstallAppButton({ variant = "default" }: { variant?: "default" | "compact" }) {
  const { standalone, canPrompt, platform } = useInstallState();
  const [showModal, setShowModal] = useState(false);

  if (standalone) return null;
  // Ne native prompt ne iOS talimatı gösterilebiliyorsa (ör. masaüstü
  // Safari/Firefox), buton yerine hiçbir şey göstermemek — YANLIŞ/işe
  // yaramaz bir talimat sunmaktan iyidir.
  if (!canPrompt && platform !== "ios") return null;

  async function handleClick() {
    if (canPrompt) {
      await promptInstall();
      return;
    }
    setShowModal(true);
  }

  const label = "Uygulamayı indir";

  return (
    <>
      <button
        onClick={handleClick}
        aria-label={label}
        className={
          variant === "compact"
            ? "flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 text-xs font-semibold text-text-secondary sm:px-3"
            : "flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-text-on-accent"
        }
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0">
          <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 19h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {variant === "compact" ? <span className="hidden sm:inline">{label}</span> : label}
      </button>

      <InstallInstructionsModal open={showModal} platform={platform} onClose={() => setShowModal(false)} />
    </>
  );
}
