import type { MetadataRoute } from "next";

/**
 * Uygulamanın neredeyse tamamı oturum gerektirdiği için (bkz. proxy.ts),
 * yalnızca GERÇEKTEN herkese açık olan `/` (tanıtım sayfası) taranabilir
 * olarak işaretlenir — geri kalan her şey (dashboard, ayarlar, API
 * rotaları) açıkça DISALLOW edilir. Sahte/var olmayan bir sayfa için
 * "allow" verilmez.
 */
export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/home", "/accounts", "/transactions", "/debts", "/budgets", "/investments", "/reports", "/settings", "/api", "/customers", "/suppliers", "/sales", "/purchases", "/notifications", "/onboarding", "/spaces"],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
