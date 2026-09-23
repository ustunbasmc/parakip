import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Admin paneli arayüz parçaları (sunucu bileşenleri). Uygulamanın tasarım
 * belirteçlerini (surface, border, accent…) kullanır; açık/koyu tema
 * otomatik uyar.
 */

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {eyebrow ? <div className="mb-1.5">{eyebrow}</div> : null}
        <h1 className="truncate text-2xl font-extrabold tracking-tight text-text-primary">{title}</h1>
        {description ? <p className="mt-1 max-w-3xl text-sm text-text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Card({ children, className = "", padded = true }: { children: ReactNode; className?: string; padded?: boolean }) {
  return (
    <section className={`min-w-0 rounded-2xl border border-border bg-surface ${padded ? "p-4 sm:p-5" : ""} ${className}`}>
      {children}
    </section>
  );
}

export function CardHeader({ title, subtitle, action }: { title: string; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 flex min-w-0 items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="truncate text-[15px] font-bold text-text-primary">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-xs text-text-muted">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  delta,
  href,
  tone = "default",
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  /** Önceki döneme göre değişim (adet). */
  delta?: number | null;
  href?: string;
  tone?: "default" | "warning" | "danger" | "success";
  icon?: ReactNode;
}) {
  const toneRing =
    tone === "warning"
      ? "border-warning/40"
      : tone === "danger"
        ? "border-danger/40"
        : tone === "success"
          ? "border-success/40"
          : "border-border";
  const body = (
    <div className={`flex h-full min-w-0 flex-col gap-2 rounded-2xl border bg-surface p-4 transition-colors ${toneRing} ${href ? "hover:bg-surface-muted/60" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-xs font-semibold uppercase tracking-wide text-text-muted">{label}</p>
        {icon ? <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">{icon}</span> : null}
      </div>
      <p className="text-2xl font-extrabold tabular-nums text-text-primary sm:text-3xl">{value}</p>
      <div className="flex min-h-4 flex-wrap items-center gap-2 text-xs">
        {typeof delta === "number" ? (
          <span className={`rounded-full px-1.5 py-0.5 font-bold tabular-nums ${delta > 0 ? "bg-success-soft text-success" : delta < 0 ? "bg-danger-soft text-danger" : "bg-surface-muted text-text-muted"}`}>
            {delta > 0 ? "+" : ""}
            {delta}
          </span>
        ) : null}
        {hint ? <span className="text-text-muted">{hint}</span> : null}
      </div>
    </div>
  );
  return href ? (
    <Link href={href} className="block min-w-0">
      {body}
    </Link>
  ) : (
    body
  );
}

const BADGE_TONES = {
  neutral: "bg-surface-muted text-text-secondary",
  accent: "bg-accent-soft text-accent",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
} as const;

export type BadgeTone = keyof typeof BADGE_TONES;

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: BadgeTone }) {
  return (
    <span className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold ${BADGE_TONES[tone]}`}>
      {children}
    </span>
  );
}

/** Yatay kaydırılabilir tablo kabı — sayfanın kendisi asla yatay kaymaz. */
export function TableWrap({ children }: { children: ReactNode }) {
  return (
    <div className="min-w-0 overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-left text-sm">{children}</table>
      </div>
    </div>
  );
}

export function Th({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return (
    <th className={`whitespace-nowrap bg-surface-muted/70 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-text-muted ${className}`}>
      {children}
    </th>
  );
}

export function Td({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-middle ${className}`}>{children}</td>;
}

export function EmptyState({ title, hint }: { title: string; hint?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-border-strong px-6 py-10 text-center">
      <p className="text-sm font-semibold text-text-secondary">{title}</p>
      {hint ? <p className="mt-1 text-xs text-text-muted">{hint}</p> : null}
    </div>
  );
}

export function ErrorBox({ message }: { message: string }) {
  return <p className="rounded-2xl border border-danger bg-danger-soft p-4 text-sm text-danger">{message}</p>;
}

/** Sekme/filtre çipleri — her biri bir bağlantıdır (sunucu tarafı filtreleme). */
export function FilterTabs({ items, active }: { items: { value: string; label: string; href: string; count?: number }[]; active: string }) {
  return (
    <nav className="flex min-w-0 gap-1 overflow-x-auto rounded-xl border border-border bg-surface p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {items.map((it) => {
        const on = it.value === active;
        return (
          <Link
            key={it.value}
            href={it.href}
            aria-current={on ? "page" : undefined}
            className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
              on ? "bg-accent text-text-on-accent" : "text-text-secondary hover:bg-surface-muted"
            }`}
          >
            {it.label}
            {typeof it.count === "number" ? (
              <span className={`rounded-full px-1.5 text-[11px] tabular-nums ${on ? "bg-white/20" : "bg-surface-muted"}`}>{it.count}</span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

export function SearchForm({
  action,
  defaultValue,
  placeholder,
  hidden = {},
}: {
  action: string;
  defaultValue?: string;
  placeholder: string;
  /** Aramada korunacak diğer filtreler. */
  hidden?: Record<string, string>;
}) {
  return (
    <form action={action} method="get" className="flex min-w-0 flex-1 gap-2" role="search">
      {Object.entries(hidden).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
      <input
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="h-10 min-w-0 flex-1 rounded-xl border border-border bg-surface px-3 text-sm text-text-primary placeholder:text-text-muted"
      />
      <button type="submit" className="h-10 shrink-0 rounded-xl bg-accent px-4 text-sm font-bold text-text-on-accent">
        Ara
      </button>
    </form>
  );
}

export function Pagination({ page, pageCount, hrefFor, total }: { page: number; pageCount: number; hrefFor: (p: number) => string; total?: number }) {
  if (pageCount <= 1) return total !== undefined ? <p className="text-xs text-text-muted">{total} kayıt</p> : null;
  const btn = "flex h-9 min-w-9 items-center justify-center rounded-lg border border-border bg-surface px-3 text-sm font-semibold";
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-xs text-text-muted">
        {total !== undefined ? `${total} kayıt · ` : ""}Sayfa {page} / {pageCount}
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link href={hrefFor(page - 1)} className={`${btn} text-text-primary hover:bg-surface-muted`}>
            ← Önceki
          </Link>
        ) : (
          <span className={`${btn} text-text-muted opacity-50`}>← Önceki</span>
        )}
        {page < pageCount ? (
          <Link href={hrefFor(page + 1)} className={`${btn} text-text-primary hover:bg-surface-muted`}>
            Sonraki →
          </Link>
        ) : (
          <span className={`${btn} text-text-muted opacity-50`}>Sonraki →</span>
        )}
      </div>
    </div>
  );
}

/** Basit dikey çubuk grafik (günlük seriler için) — sunucuda çizilir, JS gerekmez. */
export function BarSeries({
  data,
  label,
  valueSuffix = "",
}: {
  data: { key: string; label: string; value: number }[];
  label: string;
  valueSuffix?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex h-36 min-w-0 items-end gap-[3px]" role="img" aria-label={`${label}: toplam ${total}${valueSuffix}`}>
        {data.map((d) => (
          <div key={d.key} className="group relative flex h-full min-w-0 flex-1 items-end">
            <div
              className="w-full rounded-t-[3px] bg-accent/80 transition-colors group-hover:bg-accent"
              style={{ height: `${d.value > 0 ? Math.max((d.value / max) * 100, 4) : 1.5}%`, opacity: d.value > 0 ? 1 : 0.35 }}
            />
            <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-text-primary px-1.5 py-0.5 text-[10px] font-bold text-bg group-hover:block">
              {d.label}: {d.value}
              {valueSuffix}
            </span>
          </div>
        ))}
      </div>
      <div className="flex min-w-0 justify-between gap-2 text-[10px] text-text-muted" aria-hidden="true">
        {data.length > 0 ? <span className="whitespace-nowrap">{data[0].label}</span> : null}
        {data.length > 2 ? <span className="whitespace-nowrap">{data[Math.floor(data.length / 2)].label}</span> : null}
        {data.length > 1 ? <span className="whitespace-nowrap">{data[data.length - 1].label}</span> : null}
      </div>
    </div>
  );
}

/** Yatay oran çubukları (dağılım). */
export function ShareBars({ rows }: { rows: { label: string; value: number; tone?: string }[] }) {
  const total = rows.reduce((s, r) => s + r.value, 0);
  return (
    <div className="flex flex-col gap-3">
      {rows.map((r) => {
        const pct = total > 0 ? (r.value / total) * 100 : 0;
        return (
          <div key={r.label} className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="truncate font-semibold text-text-secondary">{r.label}</span>
              <span className="shrink-0 tabular-nums text-text-muted">
                {r.value} · %{pct.toLocaleString("tr-TR", { maximumFractionDigits: 0 })}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
              <div className={`h-full rounded-full ${r.tone ?? "bg-accent"}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function KeyValue({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
      {items.map((it) => (
        <div key={it.label} className="min-w-0">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">{it.label}</dt>
          <dd className="mt-0.5 break-words text-sm text-text-primary">{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Avatar({ name, url, size = 36 }: { name: string; url?: string | null; size?: number }) {
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toLocaleUpperCase("tr-TR"))
      .join("") || "?";
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <span
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-bold text-accent"
      style={{ width: size, height: size }}
    >
      {initials}
    </span>
  );
}
