import { WalletIcon } from "@/components/icons";
import { formatCentsAsCurrency } from "@/lib/format/amount";
import type { CurrencyAmount } from "@/lib/dashboard/queries";

export interface AssetBreakdownItem {
  label: string;
  cents: number;
}

/**
 * Dashboard'un TEK görsel odak noktası — "cesaretini tek bir yerde harca"
 * ilkesi. Marka gradyanı (--gradient-hero, tema başına tanımlı) ve hafif
 * bir yükseklik gölgesi YALNIZCA burada kullanılır; geri kalan kartlar
 * kasıtlı olarak düz kalır.
 *
 * "Toplam varlık" (totalAssetsCents) YALNIZCA TRY cinsinden hesap/
 * alacak/yatırım tutarlarının toplamıdır — döviz cinsinden tutarlar
 * SAHTE bir kur çevrimiyle bu rakama ASLA karıştırılmaz. Döviz
 * cinsinden bir bakiye VARSA (amounts içinde TRY dışı bir satır),
 * kartın altında AYRI ve AÇIKÇA etiketlenmiş olarak gösterilir — hiçbir
 * tutar sessizce kaybolmaz.
 */
export function HeroBalanceCard({
  label,
  amounts,
  emptyMessage,
  emptyHint,
  totalAssetsCents,
  breakdown,
}: {
  label: string;
  amounts: CurrencyAmount[];
  emptyMessage: string;
  emptyHint?: string;
  /** null = hesaplanamadı (ör. bir alt sorgu başarısız oldu) — bu durumda eski "yalnızca hesap bakiyesi" görünümüne dönülür. */
  totalAssetsCents?: number | null;
  breakdown?: AssetBreakdownItem[];
}) {
  const otherCurrencyAmounts = amounts.filter((a) => a.currency !== "TRY");
  const showTotalAssets = totalAssetsCents !== undefined && totalAssetsCents !== null;

  return (
    <div
      className="relative overflow-hidden rounded-3xl border border-border p-5 sm:p-6"
      style={{ backgroundImage: "var(--gradient-hero)", boxShadow: "var(--shadow-hero)" }}
    >
      <div className="flex items-center gap-2 text-text-secondary">
        <WalletIcon size={18} />
        <p className="text-sm font-semibold">{showTotalAssets ? "Toplam varlık" : label}</p>
      </div>

      <div className="mt-2.5">
        {amounts.length === 0 && !showTotalAssets ? (
          <div className="py-1">
            <p className="text-2xl font-extrabold text-text-primary">
              {formatCentsAsCurrency(0, "TRY")}
            </p>
            <p className="mt-1 text-sm text-text-muted">{emptyMessage}</p>
            {emptyHint ? <p className="text-xs text-text-muted">{emptyHint}</p> : null}
          </div>
        ) : showTotalAssets ? (
          <div className="flex flex-col gap-1">
            <p className="text-4xl font-extrabold tabular-nums text-text-primary">
              {formatCentsAsCurrency(totalAssetsCents, "TRY")}
            </p>

            {breakdown && breakdown.length > 0 ? (
              <div className="mt-2 flex flex-col gap-1 border-t border-border/60 pt-2.5">
                {breakdown.map((item) => (
                  <div key={item.label} className="flex items-center justify-between text-xs text-text-secondary">
                    <span>{item.label}</span>
                    <span className="font-semibold tabular-nums">{formatCentsAsCurrency(item.cents, "TRY")}</span>
                  </div>
                ))}
              </div>
            ) : null}

            {otherCurrencyAmounts.length > 0 ? (
              <div className="mt-2 flex flex-col gap-1 border-t border-border/60 pt-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                  Diğer para birimleri (toplama dahil değil)
                </p>
                {otherCurrencyAmounts.map((a) => (
                  <p key={a.currency} className="text-sm font-semibold tabular-nums text-text-secondary">
                    {formatCentsAsCurrency(a.cents, a.currency)}
                  </p>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {amounts.map((a) => (
              <p key={a.currency} className="text-4xl font-extrabold tabular-nums text-text-primary">
                {formatCentsAsCurrency(a.cents, a.currency)}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
