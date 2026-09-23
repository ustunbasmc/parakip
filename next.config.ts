import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Bağlantı koptuğunda gezinti, prefetch ve Server Action istekleri hata
    // vermek yerine bekletilir ve bağlantı gelince bir kez yeniden denenir;
    // useOffline() ile arayüzde uyarı gösterilir (bkz. ConnectivityLayer).
    useOffline: true,
  },
  async headers() {
    return [
      {
        // Tüm sayfalar: başka sitede çerçeve içinde açılmayı (clickjacking),
        // MIME tahminini ve gereksiz referrer/cihaz izinlerini engeller.
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
        ],
      },
      {
        // Service worker her zaman güncel sürümüyle kontrol edilsin.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
