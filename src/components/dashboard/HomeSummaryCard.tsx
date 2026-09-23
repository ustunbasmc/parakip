import { WalletIcon, ArrowUpRightIcon, ArrowDownRightIcon } from "@/components/icons";
import { DeltaBadge } from "@/components/ui/DeltaBadge";
import { formatCentsAsCurrency } from "@/lib/format/amount";
import type { CurrencyAmount } from "@/lib/dashboard/queries";

export interface AssetBreakdownItem {
  label: string;
  cents: number;
}

export interface PeriodFlow {
  incomeCents: number;
  expenseCents: number;
}

/**
 * Ana sayfanın görsel merkezi: üstte "Toplam varlık" (yalnızca TRY —
 * döviz tutarları sahte bir kurla ASLA toplanmaz, ayrı satırlarda
 * gösterilir), altta seçili
 * dönemin gelir / gider / net durumu ve önceki döneme göre değişim.
 *
 * Değişim yüzdesi yalnızca önceki dönemde gerçek bir tutar varsa
 * gösterilir (DeltaBadge). Veri alınamayan bölümler "—" ile gösterilir,
 * sıfır uydurulmaz.
 */
export function HomeSummaryCard({
  totalAssetsCents,
  breakdown,
  otherCurrencyBalances,
  hasAccounts,
  periodLabel,
  flow,
  previousFlow,
  otherCurrencyFlows,
}: {
  /** null = hesaplanamadı. */
  totalAssetsCents: number | null;
  breakdown: AssetBreakdownItem[];
  otherCurrencyBalances: CurrencyAmount[];
  hasAccounts: boolean;
  periodLabel: string;
  /** null = dönem verisi alınamadı. */
  flow: PeriodFlow | null;
  previousFlow: PeriodFlow | null;
  otherCurrencyFlows: { currency: string; incomeCents: number; expenseCents: number }[];
}) {
  const net = flow ? flow.incomeCents - flow.expenseCents : null;
  const prevNet = previousFlow ? previousFlow.incomeCents - previousFlow.expenseCents : null;

  return (
    <section
      aria-label="Genel durum"
      className="animate-rise relative overflow-hidden rounded-3xl border p-5 sm:p-6"
      style={{
        backgroundImage: "var(--gradient-hero)",
        boxShadow: "var(--shadow-hero)",
        borderColor: "color-mix(in srgb, var(--color-accent) 28%, var(--color-border))",
      }}
    >
      {/* Sağ üstte kontrollü, bulanık bir marka ışığı — metnin arkasına düşmez. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full opacity-40 blur-3xl"
        style={{ background: "var(--color-accent)" }}
      />

      <div className="relative">
        <div className="flex items-center gap-2 text-text-secondary">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-soft text-accent">
            <WalletIcon size={15} />
          </span>
          <p className="text-sm font-semibold">Toplam varlık</p>
        </div>

        {totalAssetsCents === null ? (
          <p className="mt-3 text-3xl font-extrabold text-text-muted">—</p>
        ) : (
          <p className="mt-2 break-words text-[2.1rem] font-extrabold leading-tight tracking-tight tabular-nums text-text-primary sm:text-5xl">
            {formatCentsAsCurrency(totalAssetsCents, "TRY")}
          </p>
        )}

        {!hasAccounts ? (
          <p className="mt-1 text-xs text-text-muted">Henüz hesap eklenmedi. İlk hesabını eklediğinde net durumun burada görünecek.</p>
        ) : breakdown.length > 0 ? (
          // Dar ekranda etiket–tutar satırları, sm ve üstünde 3 sütun.
          <div className="mt-3 flex flex-col gap-1 rounded-xl bg-[var(--tile-bg)] px-3 py-2 backdrop-blur-sm sm:grid sm:grid-cols-3 sm:gap-2 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
            {breakdown.map((b) => (
              <div
                key={b.label}
                className="flex min-w-0 items-baseline justify-between gap-2 sm:flex-col sm:items-start sm:gap-0 sm:rounded-xl sm:bg-[var(--tile-bg)] sm:px-2.5 sm:py-2 sm:backdrop-blur-sm"
              >
                <p className="truncate text-[11px] font-semibold text-text-muted sm:text-[10px] sm:uppercase sm:tracking-wide">{b.label}</p>
                <p className="shrink-0 whitespace-nowrap text-xs font-bold tabular-nums text-text-primary">{formatCentsAsCurrency(b.cents, "TRY")}</p>
              </div>
            ))}
          </div>
        ) : null}

        {otherCurrencyBalances.length > 0 ? (
          <p className="mt-2 text-[11px] text-text-muted">
            Toplama dahil olmayan:{" "}
            {otherCurrencyBalances.map((a) => formatCentsAsCurrency(a.cents, a.currency)).join(" · ")}
          </p>
        ) : null}

        <div className="my-4 h-px w-full" style={{ background: "linear-gradient(90deg, transparent, var(--color-border-strong), transparent)" }} />

        <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-text-muted">{periodLabel}</p>

        <div className="grid grid-cols-2 gap-2">
          <Stat
            label="Gelir"
            icon={<ArrowUpRightIcon size={13} />}
            iconClass="bg-income-soft text-income"
            valueClass="text-income"
            cents={flow?.incomeCents ?? null}
            delta={flow && previousFlow ? <DeltaBadge current={flow.incomeCents} previous={previousFlow.incomeCents} goodWhen="up" /> : null}
          />
          <Stat
            label="Gider"
            icon={<ArrowDownRightIcon size={13} />}
            iconClass="bg-expense-soft text-expense"
            valueClass="text-expense"
            cents={flow?.expenseCents ?? null}
            delta={flow && previousFlow ? <DeltaBadge current={flow.expenseCents} previous={previousFlow.expenseCents} goodWhen="down" /> : null}
          />
        </div>

        {/* Net durum — tam genişlikte, ayrı satır: dar ekranlarda bile işaret
            ve tutar aynı satırda kalır. */}
        <div className="mt-2 flex min-w-0 items-center gap-3 rounded-2xl bg-[var(--tile-bg)] px-3 py-2.5 backdrop-blur-sm">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-balance-soft text-sm font-black text-balance" aria-hidden="true">
            ±
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold text-text-secondary">Net durum</p>
            <p
              className={`whitespace-nowrap text-lg font-extrabold leading-tight tabular-nums ${
                net === null ? "text-text-muted" : net >= 0 ? "text-income" : "text-expense"
              }`}
            >
              {net === null ? "—" : `${net > 0 ? "+" : net < 0 ? "−" : ""}${formatCentsAsCurrency(Math.abs(net), "TRY")}`}
            </p>
          </div>
          {net !== null && prevNet !== null ? <DeltaBadge current={net} previous={prevNet} goodWhen="up" /> : null}
        </div>

        {otherCurrencyFlows.length > 0 ? (
          <div className="mt-3 flex flex-col gap-0.5 text-[11px] text-text-muted">
            {otherCurrencyFlows.map((f) => (
              <p key={f.currency}>
                {f.currency}: +{formatCentsAsCurrency(f.incomeCents, f.currency)} / −{formatCentsAsCurrency(f.expenseCents, f.currency)}
              </p>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function Stat({
  label,
  icon,
  iconClass,
  valueClass,
  cents,
  delta,
}: {
  label: string;
  icon: React.ReactNode;
  iconClass: string;
  valueClass: string;
  cents: number | null;
  delta: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-2xl bg-[var(--tile-bg)] p-2 backdrop-blur-sm sm:p-2.5">
      <div className="flex min-w-0 items-center gap-1.5">
        <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md ${iconClass}`} aria-hidden="true">
          {icon}
        </span>
        <span className="truncate text-[11px] font-semibold text-text-secondary">{label}</span>
      </div>
      <p className={`text-[clamp(0.95rem,4.6vw,1.25rem)] font-extrabold leading-tight tabular-nums [overflow-wrap:anywhere] ${valueClass}`}>
        {cents === null ? "—" : formatCentsAsCurrency(cents, "TRY")}
      </p>
      <div className="h-4">{delta}</div>
    </div>
  );
}
