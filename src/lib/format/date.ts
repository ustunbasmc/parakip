/**
 * Tarih/vade gösterimi için saf yardımcı fonksiyonlar. Dashboard'daki
 * "son işlemler" ve "yaklaşan ödemeler" kartlarında kullanılır.
 */

import { zonedDate, zonedIsoDate, zonedMidnight } from "./tz";

const DAY_MS = 24 * 60 * 60 * 1000;

/** "YYYY-MM-DD" tarihinin gün numarası (UTC takvimi üzerinden, saat dilimsiz). */
function dayNumber(isoDate: string): number {
  const [y, m, d] = isoDate.slice(0, 10).split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
}

/**
 * İki an arasındaki TAKVİM günü farkı (b - a), uygulama saat dilimine
 * (Europe/Istanbul) göre — sunucu UTC'de çalışsa bile "bugün/dün" doğru olur.
 */
export function dayDiff(a: Date, b: Date): number {
  return dayNumber(zonedIsoDate(b)) - dayNumber(zonedIsoDate(a));
}

/**
 * Bir vade tarihini, bugüne göreli, kullanıcı dostu bir Türkçe etikete
 * çevirir. Kesin tarih yerine bu etiket kullanılması, "3 gün sonra" gibi
 * aciliyeti anında anlaşılır kılar. Vade bir takvim tarihidir
 * ("YYYY-MM-DD"), bugün ise uygulama saat dilimine göre alınır.
 */
export function formatDueDateLabel(dueDateIso: string, now: Date = new Date()): string {
  const diff = dayNumber(dueDateIso) - dayNumber(zonedIsoDate(now));

  if (diff < 0) {
    const overdue = Math.abs(diff);
    return overdue === 1 ? "Dün gecikti" : `${overdue} gün gecikti`;
  }
  if (diff === 0) return "Bugün";
  if (diff === 1) return "Yarın";
  if (diff <= 7) return `${diff} gün sonra`;
  const [y, m, d] = dueDateIso.slice(0, 10).split("-").map(Number);
  return new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d)));
}

/** Bir işlem zaman damgasını kısa, göreli bir Türkçe etikete çevirir. */
export function formatRelativeDate(isoTimestamp: string, now: Date = new Date()): string {
  const date = new Date(isoTimestamp);
  const diff = dayDiff(date, now);

  if (diff === 0) {
    return new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" }).format(date);
  }
  if (diff === 1) return "Dün";
  if (diff < 7) return `${diff} gün önce`;
  return new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", timeZone: "Europe/Istanbul" }).format(date);
}

/** Verilen anın (varsayılan: şimdi) uygulama saat dilimindeki ayının [başlangıç, bitiş) aralığı. */
export function getCurrentMonthRange(now: Date = new Date()): { start: string; end: string } {
  const z = zonedDate(now);
  return { start: zonedMidnight(z.year, z.month, 1).toISOString(), end: zonedMidnight(z.year, z.month + 1, 1).toISOString() };
}

export type DashboardPeriod = "today" | "week" | "month" | "year";

export const PERIOD_LABELS: Record<DashboardPeriod, string> = {
  today: "Bugün",
  week: "Bu hafta",
  month: "Bu ay",
  year: "Bu yıl",
};

/**
 * Dashboard'daki gelir/gider/net değişim zaman filtresi için [başlangıç,
 * bitiş) aralığını döner. Hafta Pazartesi'den başlar (tr-TR konvansiyonu).
 * Sınırlar uygulama saat dilimine (Europe/Istanbul) göre hesaplanır —
 * sunucunun saat dilimi sonucu DEĞİŞTİRMEZ.
 */
export function getPeriodRange(period: DashboardPeriod, now: Date = new Date()): { start: string; end: string } {
  const z = zonedDate(now);
  if (period === "today") {
    return { start: zonedMidnight(z.year, z.month, z.day).toISOString(), end: zonedMidnight(z.year, z.month, z.day + 1).toISOString() };
  }
  if (period === "week") {
    const startDay = z.day - (z.isoWeekday - 1);
    return {
      start: zonedMidnight(z.year, z.month, startDay).toISOString(),
      end: zonedMidnight(z.year, z.month, startDay + 7).toISOString(),
    };
  }
  if (period === "year") {
    return { start: zonedMidnight(z.year, 1, 1).toISOString(), end: zonedMidnight(z.year + 1, 1, 1).toISOString() };
  }
  return getCurrentMonthRange(now);
}

/**
 * Seçili dönemin bir önceki EŞDEĞER dönemi (dün, geçen hafta, geçen ay,
 * geçen yıl) — yalnızca karşılaştırma göstergeleri (değişim yüzdesi) için.
 * Mevcut dönemin başlangıcından biraz öncesine bakılarak bulunur; böylece
 * ay uzunluğu/saat dilimi farkı sonucu kaydırmaz.
 */
export function getPreviousPeriodRange(period: DashboardPeriod, now: Date = new Date()): { start: string; end: string } {
  const current = getPeriodRange(period, now);
  const back = period === "week" ? 3 * DAY_MS : 12 * 60 * 60 * 1000;
  return getPeriodRange(period, new Date(new Date(current.start).getTime() - back));
}
