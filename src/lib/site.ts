/**
 * Sitenin asıl (canonical) adresi. Canlıda alan adı sabittir: parakip.com
 * www.parakip.com'a 308 ile yönlendiği için canonical, sitemap ve paylaşım
 * görselleri doğrudan www adresini kullanır (yönlenen bir adres "asıl
 * adres" olarak bildirilmez). Önizleme ve yerel ortamda
 * NEXT_PUBLIC_SITE_URL, yoksa localhost kullanılır.
 */
export const PRODUCTION_SITE_URL = "https://www.parakip.com";

export function siteUrl(): string {
  if (process.env.VERCEL_ENV === "production") return PRODUCTION_SITE_URL;
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/+$/, "");
}

export function absoluteUrl(path: string): string {
  return `${siteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}
