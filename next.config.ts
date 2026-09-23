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
