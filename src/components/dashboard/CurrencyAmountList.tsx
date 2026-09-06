import { formatCentsAsCurrency } from "@/lib/format/amount";
import type { CurrencyAmount } from "@/lib/dashboard/queries";

/**
 * Birden fazla para birimi varsa HEPSİNİ AYRI AYRI gösterir — otomatik
 * toplam dönüşümü YAPILMAZ (proje genelindeki "farklı para birimleri
 * tek bir sayıda uydurulmaz" ilkesiyle tutarlı, bkz. yatırım modülü).
 */
export function CurrencyAmountList({
  amounts,
  emptyMessage,
  colorClassName,
  size = "lg",
}: {
  amounts: CurrencyAmount[];
  emptyMessage: string;
  colorClassName?: string;
  /** "lg" (varsayılan): tek başına geniş kartlar için. "md": dar/2-sütunlu
   * kartlarda (ör. yan yana gelir+gider) taşmayı önlemek için. */
  size?: "lg" | "md";
}) {
  if (amounts.length === 0) {
    return <p className="text-sm text-text-muted">{emptyMessage}</p>;
  }

  const sizeClass = size === "lg" ? "text-2xl" : "text-lg";

  return (
    <div className="flex flex-col gap-0.5">
      {amounts.map((a) => (
        <p
          key={a.currency}
          className={`${sizeClass} font-bold tabular-nums ${colorClassName ?? "text-text-primary"}`}
        >
          {formatCentsAsCurrency(a.cents, a.currency)}
        </p>
      ))}
    </div>
  );
}
