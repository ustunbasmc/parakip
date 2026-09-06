import type { MetadataRoute } from "next";

/**
 * Yalnızca GERÇEKTEN herkese açık, oturumsuz erişilebilen sayfa — `/`
 * (tanıtım sayfası). Uygulamanın geri kalanı oturum gerektirdiği için
 * (bkz. proxy.ts) arama motoru sitemap'ine dahil EDİLMEZ — var olmayan
 * veya erişilemeyen bir sayfaya sahte link verilmez.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  return [
    {
      url: siteUrl,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}
