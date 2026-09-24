/**
 * Hata "parmak izi": aynı hatanın tekrarlarını tek kayıtta toplamak için.
 * Değişken kısımlar (sayılar, UUID'ler, dosya karmaları, satır:sütun)
 * normalize edilir. Hem tarayıcıda hem sunucuda çalışır (saf fonksiyon).
 */

export function normalizeMessage(message: string): string {
  return message
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "<id>")
    .replace(/\b[0-9a-f]{16,}\b/gi, "<hash>")
    .replace(/\d+/g, "<n>")
    .slice(0, 300);
}

/** İlk anlamlı yığın satırı; dosya karması ve satır:sütun atılır. */
export function topFrame(stack: string | undefined | null): string {
  if (!stack) return "";
  const line = stack
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.startsWith("at ") || l.includes("@"));
  if (!line) return "";
  return line
    .replace(/https?:\/\/[^/\s)]+/g, "")
    .replace(/[?&]v=[\w-]+/g, "")
    .replace(/[.-][0-9a-z_]{6,}\.js/gi, ".js")
    .replace(/:\d+:\d+/g, "")
    .slice(0, 200);
}

/** Sorgu parametresiz, dinamik kimlikleri maskelenmiş yol (kişisel veri tutulmaz). */
export function sanitizePath(path: string | undefined | null): string | null {
  if (!path) return null;
  const clean = path.split(/[?#]/)[0] ?? "";
  return clean
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "[id]")
    .replace(/\/[a-f0-9]{32,}(?=\/|$)/gi, "/[token]")
    .slice(0, 300);
}

function fnv1a(input: string, seed: number): number {
  let h = seed >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function errorFingerprint(parts: { source: string; message: string; stack?: string | null; route?: string | null }): string {
  const key = [parts.source, normalizeMessage(parts.message), topFrame(parts.stack), parts.route ?? ""].join("|");
  return fnv1a(key, 0x811c9dc5).toString(16).padStart(8, "0") + fnv1a(key, 0x01000193).toString(16).padStart(8, "0");
}
