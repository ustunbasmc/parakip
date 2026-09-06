"use client";

import { toCsv, triggerCsvDownload } from "@/lib/csv";

/**
 * Ekranın üst kısmında kullanılacak genel amaçlı CSV dışa aktarma butonu.
 * Yalnızca ZATEN EKRANA YÜKLENMİŞ (aktif alan + geçerli filtrelerle RLS'e
 * tabi sorgulanmış) veriyi dışa aktarır — ayrı, sınırsız bir sorgu
 * YAPMAZ. Sahte/boş dosya oluşturmaz; veri yoksa buton yine de gerçek,
 * yalnızca başlık satırlı bir CSV üretir (davranış dürüst ve öngörülebilir).
 */
export function ExportCsvButton({ headers, rows, filename, label = "CSV indir" }: { headers: string[]; rows: string[][]; filename: string; label?: string }) {
  function handleClick() {
    const csv = toCsv(headers, rows);
    triggerCsvDownload(filename, csv);
  }

  return (
    <button
      onClick={handleClick}
      title={label}
      className="flex h-9 w-9 shrink-0 items-center justify-center gap-1.5 rounded-full border border-border bg-surface px-0 text-xs font-semibold text-text-secondary active:bg-surface-muted sm:w-auto sm:px-3.5"
      aria-label={label}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0">
        <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 19h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
