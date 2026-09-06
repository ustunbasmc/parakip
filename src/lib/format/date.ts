/**
 * Tarih/vade gösterimi için saf yardımcı fonksiyonlar. Dashboard'daki
 * "son işlemler" ve "yaklaşan ödemeler" kartlarında kullanılır.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Bugünün (yerel saat) başlangıcını döner — gün farkı hesaplarken kullanılır. */
function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** İki tarih arasındaki tam gün farkını döner (b - a). */
export function dayDiff(a: Date, b: Date): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / DAY_MS);
}

/**
 * Bir vade tarihini, bugüne göreli, kullanıcı dostu bir Türkçe etikete
 * çevirir. Kesin tarih yerine bu etiket kullanılması, "3 gün sonra" gibi
 * aciliyeti anında anlaşılır kılar.
 */
export function formatDueDateLabel(dueDateIso: string, now: Date = new Date()): string {
  const due = new Date(dueDateIso + "T00:00:00");
  const diff = dayDiff(now, due);

  if (diff < 0) {
    const overdue = Math.abs(diff);
    return overdue === 1 ? "Dün gecikti" : `${overdue} gün gecikti`;
  }
  if (diff === 0) return "Bugün";
  if (diff === 1) return "Yarın";
  if (diff <= 7) return `${diff} gün sonra`;
  return new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short" }).format(due);
}

/** Bir işlem zaman damgasını kısa, göreli bir Türkçe etikete çevirir. */
export function formatRelativeDate(isoTimestamp: string, now: Date = new Date()): string {
  const date = new Date(isoTimestamp);
  const diff = dayDiff(date, now);

  if (diff === 0) {
    return new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit" }).format(date);
  }
  if (diff === 1) return "Dün";
  if (diff < 7) return `${diff} gün önce`;
  return new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short" }).format(date);
}

/** Verilen tarihin (varsayılan: bugün) bulunduğu ayın [başlangıç, bitiş) aralığını ISO olarak döner. */
export function getCurrentMonthRange(now: Date = new Date()): { start: string; end: string } {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

export type DashboardPeriod = "today" | "week" | "month" | "year";

export const PERIOD_LABELS: Record<DashboardPeriod, string> = {
  today: "Bugün",
  week: "Bu hafta",
  month: "Bu ay",
  year: "Bu yıl",
};

/**
 * Dashboard'daki gelir/gider/net değişim zaman filtresi için
 * [başlangıç, bitiş) aralığını döner. Hafta Pazartesi'den başlar (tr-TR
 * konvansiyonu). "occurred_at" üzerinden hesaplama yapıldığı için burada
 * yalnızca gün sınırları önemlidir, saat dilimi karmaşasından kaçınmak
 * için yerel (tarayıcı/sunucu) saat dilimi kullanılır — tüm proje zaten
 * bu konvansiyonu izliyor (bkz. getCurrentMonthRange).
 */
export function getPeriodRange(period: DashboardPeriod, now: Date = new Date()): { start: string; end: string } {
  if (period === "today") {
    const start = startOfDay(now);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start: start.toISOString(), end: end.toISOString() };
  }

  if (period === "week") {
    const start = startOfDay(now);
    // Pazartesi = 1 ... Pazar = 0 → Pazar'ı haftanın SONUNA taşımak için 7'ye çeviriyoruz.
    const isoDay = start.getDay() === 0 ? 7 : start.getDay();
    start.setDate(start.getDate() - (isoDay - 1));
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return { start: start.toISOString(), end: end.toISOString() };
  }

  if (period === "year") {
    const start = new Date(now.getFullYear(), 0, 1);
    const end = new Date(now.getFullYear() + 1, 0, 1);
    return { start: start.toISOString(), end: end.toISOString() };
  }

  return getCurrentMonthRange(now);
}
