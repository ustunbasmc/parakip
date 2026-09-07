/**
 * Türkiye cep telefonu normalizasyonu. "0532 123 45 67", "+90 532 123
 * 45 67", "5321234567" gibi yaygın giriş biçimlerinin hepsini KABUL
 * edip TEK standart formatta (+905XXXXXXXXX) döndürür — bu, migration
 * 0056'daki profiles_phone_format_check kısıtıyla AYNI kuralı izler.
 * Geçersiz/eksik girişte null döner (form bu durumda reddetmelidir).
 */
export function normalizeTurkishPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");

  let core: string | null = null;
  if (digits.length === 10 && digits.startsWith("5")) {
    core = digits;
  } else if (digits.length === 11 && digits.startsWith("05")) {
    core = digits.slice(1);
  } else if (digits.length === 12 && digits.startsWith("905")) {
    core = digits.slice(2);
  }

  if (!core || !/^5\d{9}$/.test(core)) return null;
  return `+90${core}`;
}

/** Kullanıcıya göstermek için okunabilir biçim: "0532 123 45 67". */
export function formatTurkishPhoneForDisplay(normalized: string): string {
  const match = normalized.match(/^\+90(\d{3})(\d{3})(\d{2})(\d{2})$/);
  if (!match) return normalized;
  return `0${match[1]} ${match[2]} ${match[3]} ${match[4]}`;
}
