"use client";

import { useEffect, useRef } from "react";

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  /** Kapanmadan önce onay istenmeli mi (ör. kaydedilmemiş form verisi var)? true dönerse kapanma iptal edilir. */
  confirmClose?: () => boolean;
}

/**
 * Mobilde alttan açılan bottom-sheet, masaüstünde ortalanmış modal —
 * TEK bileşen, iki görünüm (Tailwind breakpoint'i ile). Formlar (Gelir/
 * Gider/Transfer vb.) bu modalin İÇİNE render edilir; sayfa navigasyonu
 * YAPILMAZ, arkadaki liste/sayfa aynen kalır.
 *
 * Kapatma: dışarı tıklama, Escape, cihaz geri tuşu — üçü de AYNI
 * `close()` fonksiyonunu çağırır. Bu bir NAVİGASYON DEĞİLDİR (route
 * değişmez), bu yüzden history.back() kullanımı ProfileMenu/
 * SpaceSwitcher'daki "gerçek navigasyonla yarışma" riskini TAŞIMAZ —
 * yine de aynı kanıtlanmış history-push/pop deseniyle tutarlılık
 * sağlanır.
 */
export function Modal({ open, title, onClose, children, confirmClose }: ModalProps) {
  const pushedHistoryRef = useRef(false);

  function close() {
    if (confirmClose && !confirmClose()) return;
    if (pushedHistoryRef.current) {
      pushedHistoryRef.current = false;
      window.history.back();
    } else {
      onClose();
    }
  }

  useEffect(() => {
    if (!open) return;
    window.history.pushState({ modalOpen: true }, "");
    pushedHistoryRef.current = true;

    function handlePopState() {
      pushedHistoryRef.current = false;
      onClose();
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    window.addEventListener("popstate", handlePopState);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      document.removeEventListener("keydown", handleKeyDown);
      if (pushedHistoryRef.current) {
        window.history.replaceState(null, "");
        pushedHistoryRef.current = false;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        className="flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-border bg-bg shadow-xl sm:max-h-[85dvh] sm:max-w-md sm:rounded-3xl"
        style={{ touchAction: "pan-y" }}
      >
        <div className="mx-auto mt-2.5 h-1 w-9 shrink-0 rounded-full bg-border sm:hidden" aria-hidden="true" />
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <p className="text-base font-bold text-text-primary">{title}</p>
          <button
            onClick={close}
            aria-label="Kapat"
            className="flex h-8 w-8 items-center justify-center rounded-full text-text-muted hover:bg-surface-muted"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 6l12 12M6 18L18 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
          {children}
        </div>
      </div>
    </div>
  );
}
