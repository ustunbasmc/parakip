import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "next-themes";
import { ThemeSync } from "@/lib/theme/ThemeSync";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { ConnectivityLayer } from "@/components/ConnectivityLayer";
import { siteUrl } from "@/lib/site";

// NOT: next/font/google (Geist) kasıtlı olarak KULLANILMIYOR — bkz. eski
// yorum satırları (git geçmişi); sistem font yığını + self-hosted Manrope
// (@fontsource) kullanılıyor, ağ isteği gerektirmiyor.

export const metadata: Metadata = {
  // Canlıda https://www.parakip.com (bkz. lib/site.ts); canonical ve
  // paylaşım görseli adresleri buna göre mutlak adrese çevrilir.
  metadataBase: new URL(siteUrl()),
  title: "Parakip — Paran kontrolünde.",
  description: "Kişisel ve küçük işletme finansını tek yerden yönet.",
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#0a1120" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="tr" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <ThemeSync />
          <ConnectivityLayer />
          {children}
        </ThemeProvider>
        {/* Gerçek kullanıcı sayfa hızı ölçümü (Vercel Speed Insights). */}
        <SpeedInsights />
      </body>
    </html>
  );
}
