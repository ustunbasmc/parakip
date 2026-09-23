/**
 * Uygulamanın takvim saat dilimi. Gün/hafta/ay/yıl sınırları, sunucunun
 * (Vercel'de UTC) veya tarayıcının saat dilimine göre DEĞİL, her zaman bu
 * saat dilimine göre hesaplanır. Aksi halde Türkiye saatiyle ayın ilk
 * gecesi 00:00–03:00 arasında sunucu hâlâ önceki ayda olduğundan "bu ay"
 * yanlış ayı gösteriyordu.
 *
 * Saf fonksiyonlardır; hem sunucuda hem tarayıcıda aynı sonucu verir
 * (yalnızca Intl kullanır).
 */
export const APP_TIME_ZONE = "Europe/Istanbul";

export interface ZonedDate {
  year: number;
  /** 1–12 */
  month: number;
  day: number;
  /** ISO hafta günü: Pazartesi = 1 … Pazar = 7 */
  isoWeekday: number;
}

const partsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "numeric",
  day: "numeric",
  weekday: "short",
  hour12: false,
});

const WEEKDAYS: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

/** Bir anın uygulama saat dilimindeki takvim tarihi. */
export function zonedDate(date: Date = new Date()): ZonedDate {
  const parts = Object.fromEntries(partsFormatter.formatToParts(date).map((p) => [p.type, p.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    isoWeekday: WEEKDAYS[parts.weekday] ?? 1,
  };
}

const offsetFormatter = new Intl.DateTimeFormat("en-US", { timeZone: APP_TIME_ZONE, timeZoneName: "longOffset" });

/** Saat diliminin verilen andaki UTC farkı (dakika; İstanbul için +180). */
function offsetMinutes(date: Date): number {
  const name = offsetFormatter.formatToParts(date).find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const m = name.match(/GMT([+-])(\d{2}):?(\d{2})?/);
  if (!m) return 0;
  const sign = m[1] === "-" ? -1 : 1;
  return sign * (Number(m[2]) * 60 + Number(m[3] ?? 0));
}

/**
 * Uygulama saat dilimindeki y-a-g 00:00'ın gerçek anı. Ay/gün taşmaları
 * (ör. ay=13, gün=0) Date.UTC gibi normalize edilir.
 */
export function zonedMidnight(year: number, month: number, day: number): Date {
  const utcGuess = Date.UTC(year, month - 1, day);
  const offset = offsetMinutes(new Date(utcGuess));
  return new Date(utcGuess - offset * 60_000);
}

/** "YYYY-MM-DD" — uygulama saat dilimine göre bugünün (veya verilen anın) tarihi. */
export function zonedIsoDate(date: Date = new Date()): string {
  const z = zonedDate(date);
  return `${z.year}-${String(z.month).padStart(2, "0")}-${String(z.day).padStart(2, "0")}`;
}

/** "YYYY-MM-01" — bütçelerin saklandığı ay biçimi (bkz. migration 0022). */
export function zonedMonthIso(date: Date = new Date()): string {
  const z = zonedDate(date);
  return `${z.year}-${String(z.month).padStart(2, "0")}-01`;
}

/** "YYYY-MM" — aylık gruplama anahtarı. */
export function zonedMonthKey(date: Date): string {
  const z = zonedDate(date);
  return `${z.year}-${String(z.month).padStart(2, "0")}`;
}

/** "YYYY-MM-01" biçimindeki bir aya `delta` ay ekler. */
export function shiftMonthIso(monthIso: string, delta: number): string {
  const [y, m] = monthIso.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

/**
 * URL'deki "YYYY-MM" ay parametresini "YYYY-MM-01" biçimine çevirir;
 * geçersizse null döner.
 */
export function parseMonthParam(value: string | undefined | null): string | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})$/.exec(value);
  if (!m) return null;
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  return `${m[1]}-${m[2]}-01`;
}

/** "YYYY-MM-01" → "Eylül 2026" (takvim ayı; saat diliminden bağımsız). */
export function formatMonthIso(monthIso: string): string {
  const [y, m] = monthIso.split("-").map(Number);
  const label = new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, 1))
  );
  return label.charAt(0).toLocaleUpperCase("tr-TR") + label.slice(1);
}
