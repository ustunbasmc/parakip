"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { PlusIcon, ChevronDownIcon, CheckIcon } from "@/components/icons";

export interface SpaceOption {
  id: string;
  type: "home" | "business";
  name: string;
}

interface SpaceSwitcherProps {
  options: SpaceOption[];
  activeId: string;
}

/**
 * Aktif alan seçici — buton + açılır panel (mobilde bottom sheet,
 * masaüstünde popover; AYNI panel, yalnızca Tailwind `sm:` kırılımıyla
 * konumu değişir, JS tabanlı viewport algılama YOK).
 *
 * Yatay taşma/yan yana sekme YOK — her zaman TEK bir "[Alan adı] ⌄"
 * butonu, panel yalnızca açıkken görünür.
 *
 * Kapanma: dışarı tıklama, Escape, VE cihaz geri tuşu (panel açılırken
 * geçici bir history girdisi eklenir; kapatma/seçim bu girdiyi
 * `history.back()` ile tüketir — böylece geri tuşu sayfadan çıkmak
 * yerine yalnızca paneli kapatır).
 */
export function SpaceSwitcher({ options, activeId }: SpaceSwitcherProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const pushedHistoryRef = useRef(false);

  const active = options.find((o) => o.id === activeId);

  /** Navigasyon OLMAYAN kapatma (dışarı tıklama/Escape) — bkz. ProfileMenu'deki aynı gerekçe. */
  function dismiss() {
    if (pushedHistoryRef.current) {
      window.history.back();
    } else {
      setOpen(false);
    }
  }

  /**
   * GERÇEK navigasyon (bir seçenek/"Yeni alan ekle" tıklaması) — ASLA
   * history.back() ile YARIŞMAZ: geçici history girdisi (varsa)
   * replaceState ile SESSİZCE tüketilir, panel SENKRON kapatılır, sonra
   * DOĞRUDAN router.push çağrılır. Bkz. ProfileMenu'deki aynı kök neden
   * düzeltmesi.
   */
  function navigateTo(href: string) {
    if (pushedHistoryRef.current) {
      window.history.replaceState(null, "", window.location.href);
      pushedHistoryRef.current = false;
    }
    setOpen(false);
    router.push(href);
  }

  useEffect(() => {
    function handlePopState() {
      setOpen(false);
      pushedHistoryRef.current = false;
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (!open) return;

    window.history.pushState({ spaceSwitcherOpen: true }, "");
    pushedHistoryRef.current = true;

    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        dismiss();
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") dismiss();
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);


  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-full bg-surface-muted py-1.5 pl-3.5 pr-2.5 text-sm font-semibold text-text-primary"
      >
        <span className="max-w-[9rem] truncate">{active?.name ?? "Alan seç"}</span>
        <ChevronDownIcon size={15} className={`text-text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open ? (
        <>
          {/* Mobilde arka planı hafifçe karartan katman — yalnızca bottom-sheet modunda (sm altı) görünür. */}
          <div className="fixed inset-0 z-40 bg-black/20 sm:hidden" aria-hidden="true" />

          <div
            role="listbox"
            aria-label="Aktif alan"
            className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl border border-border bg-bg-elevated p-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-xl sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-full sm:mt-2 sm:w-64 sm:rounded-2xl"
          >
            <div className="mx-auto mb-2 h-1 w-9 rounded-full bg-border sm:hidden" aria-hidden="true" />
            <p className="px-2 pb-1 pt-1 text-xs font-semibold uppercase tracking-wide text-text-muted">Alanlar</p>
            <div className="flex flex-col gap-0.5">
              {options.map((option) => {
                const isActive = option.id === activeId;
                return (
                  <button
                    key={option.id}
                    role="option"
                    aria-selected={isActive}
                    onClick={() => navigateTo(`${pathname}?space=${option.id}`)}
                    className={`flex min-w-0 items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                      isActive ? "bg-accent-soft text-accent" : "text-text-primary hover:bg-surface-muted"
                    }`}
                  >
                    <span className="truncate">{option.name}</span>
                    {isActive ? <CheckIcon size={16} /> : null}
                  </button>
                );
              })}
            </div>
            <div className="my-1.5 border-t border-border" />
            <button
              onClick={() => navigateTo("/spaces/new-business")}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-accent hover:bg-surface-muted"
            >
              <PlusIcon size={16} />
              Yeni alan ekle
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
