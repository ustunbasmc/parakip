"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/Modal";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * "Ana ekrana ekle" — platforma göre davranır:
 * - Android/Chrome (ve destekleyen diğer tarayıcılar): `beforeinstallprompt`
 *   yakalanmışsa tıklayınca NATİF kurulum diyaloğunu açar.
 * - iOS Safari: native bir install API'si YOKTUR — tıklayınca "Paylaş >
 *   Ana Ekrana Ekle" adımlarını gösteren bir talimat modalı açılır.
 * - Uygulama zaten yüklü/standalone modda çalışıyorsa (kullanıcı zaten
 *   ana ekrandan açmış) buton HİÇ gösterilmez.
 */
export function InstallAppButton({ variant = "default" }: { variant?: "default" | "compact" }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(true); // varsayılan: gösterme (hydration sırasında flicker olmasın)
  const [isIos, setIsIos] = useState(false);
  const [showIosModal, setShowIosModal] = useState(false);

  useEffect(() => {
    Promise.resolve().then(() => {
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as unknown as { standalone?: boolean }).standalone === true;
      setIsStandalone(standalone);
      setIsIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    });

    function handleBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    }
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, []);

  if (isStandalone) return null;
  // Ne native prompt ne iOS talimatı gösterilebiliyorsa (ör. masaüstü
  // Safari/Firefox), buton yerine hiçbir şey göstermemek — YANLIŞ/işe
  // yaramaz bir talimat sunmaktan iyidir.
  if (!deferredPrompt && !isIos) return null;

  async function handleClick() {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      return;
    }
    setShowIosModal(true);
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

      <Modal open={showIosModal} title="Ana ekrana ekle" onClose={() => setShowIosModal(false)}>
        <div className="flex flex-col gap-4 pb-2">
          <p className="text-sm text-text-secondary">
            iPhone/iPad&apos;de Parakip&apos;i ana ekranınıza eklemek için:
          </p>
          <ol className="flex flex-col gap-3">
            <li className="flex items-start gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-bold text-accent">
                1
              </span>
              <span className="pt-0.5 text-sm text-text-secondary">
                Safari&apos;de alttaki (veya adres çubuğundaki) <strong>Paylaş</strong> ikonuna dokunun
                (kare içinden yukarı ok).
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-bold text-accent">
                2
              </span>
              <span className="pt-0.5 text-sm text-text-secondary">
                Açılan listede <strong>&quot;Ana Ekrana Ekle&quot;</strong> seçeneğini bulup dokunun.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-bold text-accent">
                3
              </span>
              <span className="pt-0.5 text-sm text-text-secondary">
                Sağ üstteki <strong>&quot;Ekle&quot;</strong>ye dokunun — Parakip artık ana ekranınızda!
              </span>
            </li>
          </ol>
        </div>
      </Modal>
    </>
  );
}
