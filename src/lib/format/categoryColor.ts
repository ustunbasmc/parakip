/**
 * Kategori için KARARLI bir görsel renk — veritabanında kategori rengi
 * tutulmadığından, kategori kimliğinden türetilir (aynı kategori her
 * ekranda aynı rengi alır). Yalnızca görsel amaçlıdır; hiçbir veri
 * değiştirilmez. Renkler tema token'larıdır (--chart-*).
 */
const PALETTE = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

export function categoryColor(categoryId: string | null | undefined): string {
  if (!categoryId) return "var(--chart-6)";
  let hash = 0;
  for (let i = 0; i < categoryId.length; i++) hash = (hash * 31 + categoryId.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

/** Grafiklerde sıralı kullanım için (ilk dilim vurgu rengi, "Diğer" gri). */
export const CHART_SERIES = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--chart-6)"];
