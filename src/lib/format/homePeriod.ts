/**
 * Ana sayfa dönem seçicisi: Bu ay, Geçen ay, Bu yıl, Özel tarih.
 * Raporlar ekranının DashboardPeriod tipinden bilinçli olarak AYRIDIR
 * (o ekranın davranışı değişmesin diye). Aralıklar [start, end) biçiminde
 * ISO döner; gün sınırları projedeki mevcut konvansiyonla aynı şekilde
 * yerel saatle hesaplanır (bkz. format/date.ts getPeriodRange).
 */

export type HomePeriod = "month" | "last_month" | "year" | "custom";

export const HOME_PERIODS: HomePeriod[] = ["month", "last_month", "year", "custom"];

export const HOME_PERIOD_LABELS: Record<HomePeriod, string> = {
  month: "Bu ay",
  last_month: "Geçen ay",
  year: "Bu yıl",
  custom: "Özel",
};

export interface DateRange {
  start: string;
  end: string;
}

export interface ResolvedHomePeriod {
  period: HomePeriod;
  range: DateRange;
  previous: DateRange;
  /** Kart başlıklarında gösterilen okunur etiket (ör. "Eylül 2026", "1 Eyl – 15 Eyl"). */
  label: string;
  /** Özel aralık seçiliyse input'ları doldurmak için (YYYY-MM-DD). */
  from?: string;
  to?: string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_CUSTOM_DAYS = 366;

function parseLocalDate(value: string): Date | null {
  if (!DATE_RE.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d ? date : null;
}

function iso(d: Date) {
  return d.toISOString();
}

function monthLabel(d: Date) {
  return new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric" }).format(d);
}

function shortDay(d: Date) {
  return new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short" }).format(d);
}

export function isHomePeriod(v: unknown): v is HomePeriod {
  return typeof v === "string" && (HOME_PERIODS as string[]).includes(v);
}

/**
 * URL parametrelerinden dönemi çözer. Geçersiz/eksik "custom" aralığı
 * sessizce "Bu ay"a düşer (hatalı bir URL boş/yanlış veri göstermesin).
 */
export function resolveHomePeriod(
  rawPeriod: string | undefined,
  rawFrom?: string,
  rawTo?: string,
  now: Date = new Date()
): ResolvedHomePeriod {
  const period: HomePeriod = isHomePeriod(rawPeriod) ? rawPeriod : "month";

  if (period === "custom") {
    const from = rawFrom ? parseLocalDate(rawFrom) : null;
    const to = rawTo ? parseLocalDate(rawTo) : null;
    if (from && to && from <= to) {
      const endExclusive = new Date(to.getFullYear(), to.getMonth(), to.getDate() + 1);
      const days = Math.round((endExclusive.getTime() - from.getTime()) / 86_400_000);
      if (days <= MAX_CUSTOM_DAYS) {
        const prevStart = new Date(from.getFullYear(), from.getMonth(), from.getDate() - days);
        return {
          period,
          range: { start: iso(from), end: iso(endExclusive) },
          previous: { start: iso(prevStart), end: iso(from) },
          label: `${shortDay(from)} – ${shortDay(to)}`,
          from: rawFrom,
          to: rawTo,
        };
      }
    }
    return resolveHomePeriod("month", undefined, undefined, now);
  }

  if (period === "year") {
    const start = new Date(now.getFullYear(), 0, 1);
    const end = new Date(now.getFullYear() + 1, 0, 1);
    const prevStart = new Date(now.getFullYear() - 1, 0, 1);
    return {
      period,
      range: { start: iso(start), end: iso(end) },
      previous: { start: iso(prevStart), end: iso(start) },
      label: String(now.getFullYear()),
    };
  }

  const offset = period === "last_month" ? -1 : 0;
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 1);
  const prevStart = new Date(now.getFullYear(), now.getMonth() + offset - 1, 1);
  return {
    period,
    range: { start: iso(start), end: iso(end) },
    previous: { start: iso(prevStart), end: iso(start) },
    label: monthLabel(start),
  };
}
