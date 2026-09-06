"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/Button";

interface ConfirmModalProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Markaya uygun, tema token'larını kullanan onay modalı — hesap
 * arşivleme gibi geri dönüşü kolay olmayan işlemler için (native
 * window.confirm YERİNE; o yalnızca form-çıkışı gibi düşük riskli
 * uyarılar için kullanılıyor, bkz. useUnsavedChangesGuard).
 *
 * Escape tuşu VE cihaz geri tuşu ile GÜVENLİ kapanır (proje genelindeki
 * SpaceSwitcher/ProfileMenu ile AYNI desen: açılışta geçici bir history
 * girdisi eklenir, geri tuşu bunu tüketip onCancel'ı tetikler — hiçbir
 * navigasyonla YARIŞMAZ çünkü bu modal kendi başına bir sayfa
 * navigasyonu YAPMAZ, yalnızca kapanır).
 */
export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "Vazgeç",
  danger,
  loading,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const pushedHistoryRef = useRef(false);
  const onCancelRef = useRef(onCancel);

  useEffect(() => {
    onCancelRef.current = onCancel;
  }, [onCancel]);

  useEffect(() => {
    if (!open) return;

    window.history.pushState({ confirmModalOpen: true }, "");
    pushedHistoryRef.current = true;

    function handlePopState() {
      pushedHistoryRef.current = false;
      onCancelRef.current();
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (pushedHistoryRef.current) {
          pushedHistoryRef.current = false;
          window.history.back();
        } else {
          onCancelRef.current();
        }
      }
    }

    window.addEventListener("popstate", handlePopState);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      document.removeEventListener("keydown", handleKeyDown);
      // Modal, geri tuşu DIŞINDA bir yolla (buton tıklaması) kapandıysa,
      // eklenen geçici history girdisini SESSİZCE tüket (back() ile
      // yeni bir navigasyon TETİKLEMEDEN) — replaceState bunu güvenle yapar.
      if (pushedHistoryRef.current) {
        window.history.replaceState(null, "");
        pushedHistoryRef.current = false;
      }
    };
  }, [open]);

  function handleOverlayCancel() {
    if (pushedHistoryRef.current) {
      pushedHistoryRef.current = false;
      window.history.back();
    } else {
      onCancel();
    }
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
      onClick={handleOverlayCancel}
    >
      <div
        className="w-full max-w-sm rounded-t-3xl border border-border bg-bg-elevated p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-modal-title" className="text-lg font-bold text-text-primary">
          {title}
        </h2>
        <p className="mt-1.5 text-sm text-text-secondary">{description}</p>
        <div className="mt-5 flex flex-col gap-2.5">
          <Button variant={danger ? "primary" : "primary"} onClick={onConfirm} loading={loading}
            className={danger ? "!bg-danger" : ""}
          >
            {confirmLabel}
          </Button>
          <Button variant="ghost" onClick={handleOverlayCancel} disabled={loading}>
            {cancelLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
