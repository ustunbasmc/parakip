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
 *
 * `disabled`: aynı listede BAZI satırlar kaydırılabilir bazıları
 * DEĞİLSE (ör. yatırım hareketlerinde yalnızca LIFO'da en son işlem
 * kaldırılabilir), bu satırları SwipeToAction'IN DIŞINDA çıplak render
 * etmek yerine `disabled` ile İÇİNDE tutmak GEREKİR — aksi halde bazı
 * satırlarda `overflow-hidden`/`touchAction:pan-y` KORUMASI eksik kalır
 * ve bu, listede tutarsız dokunma davranışına/yatay kaymaya yol açar.
 * `disabled` true iken dokunma dinleyicileri hiç eklenmez ama DOM/CSS
 * yapısı diğer satırlarla BİREBİR aynı kalır.
 */
export function SwipeToAction({
  children,
  actionLabel,
  onAction,
  danger = true,
  disabled = false,
}: {
  children: React.ReactNode;
  actionLabel: string;
  onAction: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  const [dragX, setDragX] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef<number | null>(null);
  const draggingRef = useRef(false);
  const ACTION_WIDTH = 92;
  const THRESHOLD = 24;

  function handleTouchStart(e: React.TouchEvent) {
    if (disabled) return;
    startXRef.current = e.touches[0].clientX;
    draggingRef.current = true;
    setIsDragging(true);
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (disabled || startXRef.current === null) return;
    const delta = e.touches[0].clientX - startXRef.current;
    // Yalnızca SOLA kaydırma (sağdaki aksiyonu açığa çıkarır) kabul edilir.
    const clamped = Math.min(0, Math.max(delta, -ACTION_WIDTH));
    if (Math.abs(delta) > THRESHOLD) {
      setDragX(clamped);
    }
  }

  function handleTouchEnd() {
    if (disabled || !draggingRef.current) return;
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
    <div className="relative w-full overflow-hidden rounded-2xl md:overflow-visible" style={{ touchAction: "pan-y" }}>
      {!disabled ? (
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
      ) : null}
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
