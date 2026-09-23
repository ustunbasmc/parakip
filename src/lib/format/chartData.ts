import type { CategoryBreakdownRow, MonthlyTrendRow } from "@/lib/dashboard/reports";
import type { DonutSegment } from "@/components/charts/DonutChart";
import type { TrendPoint } from "@/components/charts/TrendChart";
import { categoryColor, CHART_SERIES } from "@/lib/format/categoryColor";

/**
 * Rapor verisini grafik bileşenlerinin girdisine çeviren saf yardımcılar
 * (ana sayfa ve Raporlar ekranı ortak kullanır). Hiçbir tutar yeniden
 * hesaplanmaz; yalnızca biçim dönüştürülür.
 */

/** En büyük 5 kategori + kalanlar "Diğer" olarak birleştirilir (toplam aynı kalır). */
export function toDonutSegments(rows: CategoryBreakdownRow[]): DonutSegment[] {
  const top = rows.slice(0, 5);
  const rest = rows.slice(5).reduce((s, r) => s + r.totalCents, 0);
  const segments: DonutSegment[] = top.map((r, i) => ({
    key: r.categoryId ?? "__none__",
    label: r.categoryName,
    valueCents: r.totalCents,
    color: r.categoryId ? categoryColor(r.categoryId) : CHART_SERIES[i % CHART_SERIES.length],
  }));
  if (rest > 0) segments.push({ key: "__other__", label: "Diğer", valueCents: rest, color: "var(--chart-6)" });
  return segments;
}

export function toTrendPoints(rows: MonthlyTrendRow[]): TrendPoint[] {
  return rows.map((r) => ({
    key: r.monthKey,
    label: r.monthLabel.split(" ")[0],
    fullLabel: r.monthLabel,
    incomeCents: r.incomeCents,
    expenseCents: r.expenseCents,
  }));
}

/** En çok harcanan kategori ve toplam içindeki payı (yoksa null). */
export function topCategoryLabel(rows: CategoryBreakdownRow[]): string | null {
  const total = rows.reduce((s, r) => s + r.totalCents, 0);
  const top = rows[0];
  if (!top || total <= 0) return null;
  return `En çok harcanan: ${top.categoryName} · %${Math.round((top.totalCents / total) * 100)}`;
}
