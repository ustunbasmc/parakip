import Link from "next/link";
import { WalletIcon } from "@/components/icons";
import { formatCentsAsCurrency } from "@/lib/format/amount";
import type { CurrencyAmount } from "@/lib/dashboard/queries";

export interface AssetBreakdownItem {
  label: string;
  cents: number;
}

/**
 * Ana sayfanın en üstteki, en belirgin kartı: "Toplam varlık". Yalnızca
 * TRY cinsinden hesap + alacak + yatırım toplamıdır — döviz tutarları
 * sahte bir kurla ASLA toplanmaz, altta ayrı satırda gösterilir.
 *
 * Mobilde tek sütun (rakam üstte, dağılım altta); masaüstünde iki sütun
 * (solda büyük rakam, sağda dağılım listesi) — geniş ekran boşa gitmez.
 */
export function BalanceHeroCard({
  totalAssetsCents,
  breakdown,
  otherCurrencyBalances,
  hasAccounts,
  netWorth = null,
}: {
  /** null = hesaplanamadı (bir alt sorgu başarısız). */
  totalAssetsCents: number | null;
  breakdown: AssetBreakdownItem[];
  otherCurrencyBalances: CurrencyAmount[];
  hasAccounts: boolean;
  /** Borçlar düşülmüş net değer (dövizler kurla çevrilmiş); null = gösterme. */
  netWorth?: { netCents: number; payablesCents: number; href: string } | null;
}) {
  return (
    <section
      aria-label="Toplam varlık"
      className="animate-rise relative overflow-hidden rounded-3xl border p-5 transition-shadow sm:p-6 lg:p-7"
      style={{
        backgroundImage: "var(--gradient-hero)",
        boxShadow: "var(--shadow-hero)",
        borderColor: "color-mix(in srgb, var(--color-accent) 28%, var(--color-border))",
      }}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 -top-14 h-44 w-44 rounded-full opacity-35 blur-3xl"
        style={{ background: "var(--color-accent)" }}
      />

      <div className="relative grid min-w-0 gap-5 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] md:items-center md:gap-8">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-text-secondary">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent-soft text-accent">
              <WalletIcon size={16} />
            </span>
            <p className="text-sm font-semibold">Toplam varlık</p>
          </div>

          {totalAssetsCents === null ? (
            <p className="mt-3 text-4xl font-extrabold text-text-muted">—</p>
          ) : (
            <p className="mt-3 text-[clamp(2rem,9vw,3.4rem)] font-extrabold leading-none tracking-tight tabular-nums text-text-primary [overflow-wrap:anywhere]">
              {formatCentsAsCurrency(totalAssetsCents, "TRY")}
            </p>
          )}

          {!hasAccounts ? (
            <p className="mt-2 text-sm text-text-muted">
              Henüz hesap eklenmedi. İlk hesabını eklediğinde toplam varlığın burada görünecek.
            </p>
          ) : otherCurrencyBalances.length > 0 ? (
            <p className="mt-2 text-xs text-text-muted">
              Toplama dahil olmayan: {otherCurrencyBalances.map((a) => formatCentsAsCurrency(a.cents, a.currency)).join(" · ")}
            </p>
          ) : null}

          {hasAccounts && netWorth ? (
            <Link
              href={netWorth.href}
              className="mt-3 inline-flex max-w-full items-center gap-1.5 rounded-full bg-[var(--tile-bg)] px-3 py-1.5 text-xs font-semibold text-text-secondary backdrop-blur-sm hover:text-text-primary"
            >
              <span className="truncate">
                Net değer:{" "}
                <span className="font-bold tabular-nums text-text-primary">{formatCentsAsCurrency(netWorth.netCents, "TRY")}</span>
              </span>
              <span aria-hidden="true" className="text-accent">→</span>
            </Link>
          ) : null}
        </div>

        {hasAccounts && breakdown.length > 0 ? (
          <ul className="flex min-w-0 flex-col gap-1 rounded-2xl bg-[var(--tile-bg)] p-2 backdrop-blur-sm">
            {breakdown.map((b) => (
              <li key={b.label} className="flex min-w-0 items-center justify-between gap-3 rounded-xl px-2.5 py-2">
                <span className="truncate text-sm text-text-secondary">{b.label}</span>
                <span className="shrink-0 whitespace-nowrap text-sm font-bold tabular-nums text-text-primary">
                  {formatCentsAsCurrency(b.cents, "TRY")}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
