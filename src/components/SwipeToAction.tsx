"use client";

import { useRef, useState } from "react";

/**
 * Yalnızca MOBİLDE (md: altı) aktif, sağa kaydırınca bağlama uygun bir
 * aksiyon butonu (İptal et/Arşivle) açığa çıkaran satır sarmalayıcı.
 * Masaüstünde kaydırma DEVRE DIŞIDIR — children olduğu gibi render edilir,
 * aksiyon YALNIZCA çağıran taraf tarafından ayrıca (ör. bir menü/buton
 * ile) sağlanmalıdır.
 *
 * GÜVENLİK/UX kuralları:
 * - Minimum kaydırma eşiği (24px) altında hiçbir şey tetiklenmez —
 *   yanlışlıkla dikey kaydırmayla karışmaz.
 * - touchAction: pan-y sayesinde dikey sayfa kaydırması ASLA engellenmez;
 *   yatay hareket SAYFANIN kendisini KAYDIRMAZ (yalnızca bu satırın kendi
 *   transform'u değişir, body/html hiç etkilenmez).
 * - Aksiyon dokunması (buton) en az 44px yükseklikte, kolay dokunulur.
 */
export function SwipeToAction({
  children,
  actionLabel,
  onAction,
  danger = true,
}: {
  children: React.ReactNode;
  actionLabel: string;
  onAction: () => void;
  danger?: boolean;
}) {
  const [dragX, setDragX] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef<number | null>(null);
  const draggingRef = useRef(false);
  const ACTION_WIDTH = 92;
  const THRESHOLD = 24;

  function handleTouchStart(e: React.TouchEvent) {
    startXRef.current = e.touches[0].clientX;
    draggingRef.current = true;
    setIsDragging(true);
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (startXRef.current === null) return;
    const delta = e.touches[0].clientX - startXRef.current;
    // Yalnızca SOLA kaydırma (sağdaki aksiyonu açığa çıkarır) kabul edilir.
    const clamped = Math.min(0, Math.max(delta, -ACTION_WIDTH));
    if (Math.abs(delta) > THRESHOLD) {
      setDragX(clamped);
    }
  }

  function handleTouchEnd() {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setIsDragging(false);
    startXRef.current = null;
    if (dragX < -ACTION_WIDTH / 2) {
      setDragX(-ACTION_WIDTH);
      setRevealed(true);
    } else {
      setDragX(0);
      setRevealed(false);
    }
  }

  function handleActionClick() {
    setDragX(0);
    setRevealed(false);
    onAction();
  }

  return (
    <div className="relative overflow-hidden rounded-2xl md:overflow-visible" style={{ touchAction: "pan-y" }}>
      <div
        className={`absolute inset-y-0 right-0 flex items-center justify-center md:hidden ${danger ? "bg-danger" : "bg-warning"}`}
        style={{ width: ACTION_WIDTH }}
        aria-hidden={!revealed}
      >
        <button
          onClick={handleActionClick}
          className="flex h-full w-full min-h-[44px] items-center justify-center px-2 text-xs font-bold text-white"
        >
          {actionLabel}
        </button>
      </div>
      <div
        className="relative bg-bg transition-transform"
        style={{ transform: `translateX(${dragX}px)`, transitionDuration: isDragging ? "0ms" : "150ms" }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {children}
      </div>
    </div>
  );
}
