"use client";

import { useRef, useState } from "react";

/**
 * Yalnızca MOBİLDE (md: altı) aktif, iki yönlü kaydırma destekler:
 * - SOLA kaydırınca SAĞDA bir aksiyon açılır (mevcut "İptal et"/
 *   "Arşivle" davranışı — `actionLabel`/`onAction`/`danger` ile,
 *   GERİYE UYUMLU, hiçbir mevcut kullanım yeri DEĞİŞMEDEN çalışır).
 * - SAĞA kaydırınca SOLDA yeni bir aksiyon açılır (`leftActionLabel`/
 *   `onLeftAction` verilirse — ör. "Düzenle"). Verilmezse sağa kaydırma
 *   hiçbir şey yapmaz (yalnızca orijinal konuma geri döner).
 * Masaüstünde kaydırma DEVRE DIŞIDIR — children olduğu gibi render edilir.
 *
 * GÜVENLİK/UX kuralları:
 * - Minimum kaydırma eşiği (24px) altında hiçbir şey tetiklenmez.
 * - touchAction: pan-y sayesinde dikey sayfa kaydırması ASLA engellenmez.
 * - Aksiyon dokunmaları en az 44px yükseklikte, kolay dokunulur.
 * - Aynı anda yalnızca BİR yön açık kalabilir (sağa açıkken sola
 *   kaydırma önce sağı kapatır, ve tam tersi) — state tek bir
 *   `dragX` değeriyle tutulduğu için bu doğal olarak garanti edilir.
 *
 * `disabled`: bu satırda kaydırma AKSİYONU yoksa (ör. yatırım
 * hareketlerinde LIFO kuralı) `disabled` ile SwipeToAction'IN İÇİNDE
 * tutulmalı — aksi halde bazı satırlarda overflow-hidden/touchAction
 * koruması eksik kalır ve listede tutarsız davranışa yol açar.
 */
export function SwipeToAction({
  children,
  actionLabel,
  onAction,
  danger = true,
  disabled = false,
  leftActionLabel,
  onLeftAction,
}: {
  children: React.ReactNode;
  actionLabel: string;
  onAction: () => void;
  danger?: boolean;
  disabled?: boolean;
  /** Sağa kaydırınca SOLDA açılan ikinci aksiyon (ör. "Düzenle") — opsiyonel. */
  leftActionLabel?: string;
  onLeftAction?: () => void;
}) {
  const [dragX, setDragX] = useState(0);
  const [revealedSide, setRevealedSide] = useState<"none" | "left" | "right">("none");
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef<number | null>(null);
  const draggingRef = useRef(false);
  const ACTION_WIDTH = 92;
  const THRESHOLD = 24;
  const hasLeftAction = Boolean(leftActionLabel && onLeftAction);

  function handleTouchStart(e: React.TouchEvent) {
    if (disabled) return;
    startXRef.current = e.touches[0].clientX;
    draggingRef.current = true;
    setIsDragging(true);
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (disabled || startXRef.current === null) return;
    const delta = e.touches[0].clientX - startXRef.current;
    const maxLeft = hasLeftAction ? ACTION_WIDTH : 0;
    // Negatif (sola kaydırma) SAĞ aksiyonu, pozitif (sağa kaydırma —
    // yalnızca leftAction TANIMLIYSA) SOL aksiyonu açığa çıkarır.
    const clamped = Math.min(maxLeft, Math.max(delta, -ACTION_WIDTH));
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
      setRevealedSide("right");
    } else if (hasLeftAction && dragX > ACTION_WIDTH / 2) {
      setDragX(ACTION_WIDTH);
      setRevealedSide("left");
    } else {
      setDragX(0);
      setRevealedSide("none");
    }
  }

  function handleRightActionClick() {
    setDragX(0);
    setRevealedSide("none");
    onAction();
  }

  function handleLeftActionClick() {
    setDragX(0);
    setRevealedSide("none");
    onLeftAction?.();
  }

  return (
    <div className="relative w-full overflow-hidden rounded-2xl md:overflow-visible" style={{ touchAction: "pan-y" }}>
      {!disabled ? (
        <div
          className={`absolute inset-y-0 right-0 flex items-center justify-center md:hidden ${danger ? "bg-danger" : "bg-warning"}`}
          style={{ width: ACTION_WIDTH }}
          aria-hidden={revealedSide !== "right"}
        >
          <button
            onClick={handleRightActionClick}
            aria-label={actionLabel}
            tabIndex={revealedSide === "right" ? 0 : -1}
            className="flex h-full w-full min-h-[44px] items-center justify-center px-2 text-xs font-bold text-white"
          >
            {actionLabel}
          </button>
        </div>
      ) : null}
      {!disabled && hasLeftAction ? (
        <div
          className="absolute inset-y-0 left-0 flex items-center justify-center bg-accent md:hidden"
          style={{ width: ACTION_WIDTH }}
          aria-hidden={revealedSide !== "left"}
        >
          <button
            onClick={handleLeftActionClick}
            aria-label={leftActionLabel}
            tabIndex={revealedSide === "left" ? 0 : -1}
            className="flex h-full w-full min-h-[44px] items-center justify-center px-2 text-xs font-bold text-text-on-accent"
          >
            {leftActionLabel}
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
