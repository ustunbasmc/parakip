"use client";

import { PrinterIcon } from "@/components/icons";

/**
 * Tarayıcının yazdırma penceresini açar; oradan "PDF olarak kaydet"
 * seçilerek rapor PDF'e dönüştürülür (ek kütüphane yok). Koyu temada
 * yazdırılan sayfa okunaksız olmasın diye yazdırma süresince açık temaya
 * geçilir ve ardından eski tema geri yüklenir. Menü, gezinme ve butonlar
 * `print:hidden` ile çıktıya girmez.
 */
export function PrintButton({ label = "PDF olarak indir" }: { label?: string }) {
  function handlePrint() {
    const root = document.documentElement;
    const wasDark = root.classList.contains("dark");
    if (wasDark) {
      root.classList.remove("dark");
      window.addEventListener("afterprint", () => root.classList.add("dark"), { once: true });
    }
    window.print();
  }

  return (
    <button
      type="button"
      onClick={handlePrint}
      aria-label={label}
      className="flex h-9 w-9 shrink-0 items-center justify-center gap-1.5 rounded-full border border-border bg-surface px-0 text-xs font-semibold text-text-secondary active:bg-surface-muted sm:w-auto sm:px-3.5 print:hidden"
    >
      <PrinterIcon size={14} className="shrink-0" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
