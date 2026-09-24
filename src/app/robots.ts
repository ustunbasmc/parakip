import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";

/**
 * Herkese açık sayfalar (tanıtım, iniş sayfaları, rehber, bütçe şablonu,
 * yardım merkezi, yasal metinler) taranabilir; oturum gerektiren uygulama
 * ekranları, API ve admin açıkça DISALLOW edilir.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/home",
          "/accounts",
          "/transactions",
          "/debts",
          "/budgets",
          "/goals",
          "/investments",
          "/net-worth",
          "/reports",
          "/settings",
          "/api",
          "/customers",
          "/suppliers",
          "/sales",
          "/purchases",
          "/notifications",
          "/onboarding",
          "/spaces",
          "/support",
          "/admin",
          "/add-transaction",
          "/invitations",
          "/invite",
          "/offline",
        ],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: absoluteUrl("/").replace(/\/$/, ""),
  };
}
