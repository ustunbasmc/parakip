import { formatCentsAsCurrency, formatShare } from "@/lib/format/amount";
import { accountTypeLabel } from "@/lib/format/accountType";
import { CHART_SERIES } from "@/lib/format/categoryColor";
import { WalletIcon } from "@/components/icons";

interface AccountLike {
  id: string;
  name: string;
  type: string;
  currency: string;
  balanceCents: number;
}

/**
 * Hesaplar ekranının özet kartı. Değerler listelenen hesapların mevcut
 * bakiyelerinin TOPLAMIDIR — yeni bir hesap mantığı yoktur. Para birimleri
 * ASLA birbirine çevrilmez: ana para birimi (TRY varsa TRY) büyük
 * gösterilir, diğerleri ayrı satırda.
 *
 * Ana para biriminde:
 * - Artı bakiyeler toplamı ve eksi bakiyeler toplamı (ör. kredi kartı borcu)
 *   ayrı kutularda,
 * - artı bakiyelerin hesaplara göre dağılımı (en büyük 4 + "Diğer").
 */
export function AccountsSummaryCard({ accounts }: { accounts: AccountLike[] }) {
  const byCurrency = new Map<string, number>();
  for (const a of accounts) byCurrency.set(a.currency, (byCurrency.get(a.currency) ?? 0) + a.balanceCents);
  const primary = byCurrency.has("TRY") ? "TRY" : accounts[0]?.currency ?? "TRY";
  const others = Array.from(byCurrency.entries()).filter(([c]) => c !== primary);

  const inPrimary = accounts.filter((a) => a.currency === primary);
  const positives = inPrimary.filter((a) => a.balanceCents > 0).sort((a, b) => b.balanceCents - a.balanceCents);
  const positiveTotal = positives.reduce((s, a) => s + a.balanceCents, 0);
  const negativeTotal = inPrimary.filter((a) => a.balanceCents < 0).reduce((s, a) => s + a.balanceCents, 0);
  const net = byCurrency.get(primary) ?? 0;

  const top = positives.slice(0, 4);
  const restCents = positives.slice(4).reduce((s, a) => s + a.balanceCents, 0);
  const segments = [
    ...top.map((a, i) => ({ key: a.id, label: a.name, cents: a.balanceCents, color: CHART_SERIES[i % CHART_SERIES.length] })),
    ...(restCents > 0 ? [{ key: "__rest__", label: "Diğer", cents: restCents, color: "var(--chart-6)" }] : []),
  ];

  const typeCounts = Array.from(
    accounts.reduce((m, a) => m.set(a.type, (m.get(a.type) ?? 0) + 1), new Map<string, number>())
  ).sort((a, b) => b[1] - a[1]);

  return (
    <section
      aria-label="Toplam bakiye"
      className="animate-rise relative overflow-hidden rounded-3xl border p-4 sm:p-6"
      style={{
        backgroundImage: "var(--gradient-hero)",
        boxShadow: "var(--shadow-hero)",
        borderColor: "color-mix(in srgb, var(--color-accent) 28%, var(--color-border))",
      }}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 -top-14 h-40 w-40 rounded-full opacity-30 blur-3xl"
        style={{ background: "var(--color-accent)" }}
      />

      <div className="relative grid min-w-0 gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-start md:gap-8">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-text-secondary">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent-soft text-accent">
              <WalletIcon size={16} />
            </span>
            <p className="text-sm font-semibold">Toplam bakiye</p>
          </div>
          <p
            className={`mt-3 text-[clamp(1.9rem,8vw,3rem)] font-extrabold leading-none tracking-tight tabular-nums [overflow-wrap:anywhere] ${
              net < 0 ? "text-expense" : "text-text-primary"
            }`}
          >
            {formatCentsAsCurrency(net, primary)}
          </p>
          {others.length > 0 ? (
            <p className="mt-2 text-xs text-text-muted">
              Diğer para birimleri: {others.map(([c, cents]) => formatCentsAsCurrency(cents, c)).join(" · ")}
            </p>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-1.5">
            {typeCounts.map(([type, count]) => (
              <span key={type} className="rounded-full bg-[var(--tile-bg)] px-2.5 py-1 text-[11px] font-semibold text-text-secondary">
                {count} {accountTypeLabel(type).toLocaleLowerCase("tr-TR")}
              </span>
            ))}
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="min-w-0 rounded-2xl bg-[var(--tile-bg)] p-3">
              <p className="text-[11px] font-semibold text-text-secondary">Artı bakiyeler</p>
              <p className="truncate text-sm font-extrabold tabular-nums text-income sm:text-base">
                {formatCentsAsCurrency(positiveTotal, primary)}
              </p>
            </div>
            <div className="min-w-0 rounded-2xl bg-[var(--tile-bg)] p-3">
              <p className="text-[11px] font-semibold text-text-secondary">Eksi bakiyeler</p>
              <p className={`truncate text-sm font-extrabold tabular-nums sm:text-base ${negativeTotal < 0 ? "text-expense" : "text-text-muted"}`}>
                {formatCentsAsCurrency(negativeTotal, primary)}
              </p>
            </div>
          </div>

          {segments.length > 1 && positiveTotal > 0 ? (
            <div className="min-w-0">
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-muted">Paranın dağılımı</p>
              <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-surface-muted" aria-hidden="true">
                {segments.map((s, i) => (
                  <div
                    key={s.key}
                    className="animate-grow-x h-full"
                    style={{ width: `${(s.cents / positiveTotal) * 100}%`, background: s.color, animationDelay: `${i * 60}ms` }}
                  />
                ))}
              </div>
              <ul className="mt-2 flex flex-col gap-1">
                {segments.map((s) => (
                  <li key={s.key} className="flex min-w-0 items-center gap-2 text-xs">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.color }} aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate text-text-secondary">{s.label}</span>
                    <span className="shrink-0 font-semibold tabular-nums text-text-muted">{formatShare(s.cents, positiveTotal)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
