/**
 * Ana sayfa dönem seçicisi: Bu ay, Geçen ay, Bu yıl, Özel tarih.
 * Raporlar ekranının DashboardPeriod tipinden bilinçli olarak AYRIDIR
 * (o ekranın davranışı değişmesin diye). Aralıklar [start, end) biçiminde
 * ISO döner; gün/ay sınırları uygulama saat dilimine (Europe/Istanbul)
 * göre hesaplanır (bkz. format/tz.ts) — sunucunun saat dilimi sonucu
 * değiştirmez.
 */
import { zonedDate, zonedMidnight } from "./tz";

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

/** "YYYY-MM-DD" → geçerli bir takvim tarihiyse {y, m, d}. */
function parseIsoDate(value: string): { y: number; m: number; d: number } | null {
  if (!DATE_RE.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  const check = new Date(Date.UTC(y, m - 1, d));
  return check.getUTCFullYear() === y && check.getUTCMonth() === m - 1 && check.getUTCDate() === d ? { y, m, d } : null;
}

function iso(d: Date) {
  return d.toISOString();
}

function monthLabel(year: number, month: number) {
  return new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function shortDay(p: { y: number; m: number; d: number }) {
  return new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(p.y, p.m - 1, p.d)));
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
    const from = rawFrom ? parseIsoDate(rawFrom) : null;
    const to = rawTo ? parseIsoDate(rawTo) : null;
    const fromUtc = from ? Date.UTC(from.y, from.m - 1, from.d) : NaN;
    const toUtc = to ? Date.UTC(to.y, to.m - 1, to.d) : NaN;
    if (from && to && fromUtc <= toUtc) {
      const days = Math.round((toUtc - fromUtc) / 86_400_000) + 1;
      if (days <= MAX_CUSTOM_DAYS) {
        const start = zonedMidnight(from.y, from.m, from.d);
        const endExclusive = zonedMidnight(to.y, to.m, to.d + 1);
        const prevStart = zonedMidnight(from.y, from.m, from.d - days);
        return {
          period,
          range: { start: iso(start), end: iso(endExclusive) },
          previous: { start: iso(prevStart), end: iso(start) },
          label: `${shortDay(from)} – ${shortDay(to)}`,
          from: rawFrom,
          to: rawTo,
        };
      }
    }
    return resolveHomePeriod("month", undefined, undefined, now);
  }

  const z = zonedDate(now);
  if (period === "year") {
    const start = zonedMidnight(z.year, 1, 1);
    return {
      period,
      range: { start: iso(start), end: iso(zonedMidnight(z.year + 1, 1, 1)) },
      previous: { start: iso(zonedMidnight(z.year - 1, 1, 1)), end: iso(start) },
      label: String(z.year),
    };
  }

  const offset = period === "last_month" ? -1 : 0;
  const start = zonedMidnight(z.year, z.month + offset, 1);
  const labelDate = new Date(Date.UTC(z.year, z.month - 1 + offset, 1));
  return {
    period,
    range: { start: iso(start), end: iso(zonedMidnight(z.year, z.month + offset + 1, 1)) },
    previous: { start: iso(zonedMidnight(z.year, z.month + offset - 1, 1)), end: iso(start) },
    label: monthLabel(labelDate.getUTCFullYear(), labelDate.getUTCMonth() + 1),
  };
}
