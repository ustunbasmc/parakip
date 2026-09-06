import { WalletIcon } from "@/components/icons";
import { formatCentsAsCurrency } from "@/lib/format/amount";
import type { CurrencyAmount } from "@/lib/dashboard/queries";

/**
 * Dashboard'un TEK görsel odak noktası — "cesaretini tek bir yerde harca"
 * ilkesi. Marka gradyanı (--gradient-hero, tema başına tanımlı) ve hafif
 * bir yükseklik gölgesi YALNIZCA burada kullanılır; geri kalan kartlar
 * kasıtlı olarak düz kalır.
 */
export function HeroBalanceCard({
  label,
  amounts,
  emptyMessage,
  emptyHint,
}: {
  label: string;
  amounts: CurrencyAmount[];
  emptyMessage: string;
  emptyHint?: string;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-3xl border border-border p-5 sm:p-6"
      style={{ backgroundImage: "var(--gradient-hero)", boxShadow: "var(--shadow-hero)" }}
    >
      <div className="flex items-center gap-2 text-text-secondary">
        <WalletIcon size={18} />
        <p className="text-sm font-semibold">{label}</p>
      </div>

      <div className="mt-2.5">
        {amounts.length === 0 ? (
          <div className="py-1">
            <p className="text-2xl font-extrabold text-text-primary">
              {formatCentsAsCurrency(0, "TRY")}
            </p>
            <p className="mt-1 text-sm text-text-muted">{emptyMessage}</p>
            {emptyHint ? <p className="text-xs text-text-muted">{emptyHint}</p> : null}
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
