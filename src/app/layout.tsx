import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "next-themes";
import { ThemeSync } from "@/lib/theme/ThemeSync";

// NOT: next/font/google (Geist) kasıtlı olarak KULLANILMIYOR — bkz. eski
// yorum satırları (git geçmişi); sistem font yığını + self-hosted Manrope
// (@fontsource) kullanılıyor, ağ isteği gerektirmiyor.

export const metadata: Metadata = {
  // NOT: Gerçek üretim alan adı belirlendiğinde NEXT_PUBLIC_SITE_URL ortam
  // değişkeni olarak ayarlanmalı — aksi halde Open Graph URL'leri bu
  // yerel/varsayılan adrese göre çözülür (yalnızca geliştirme ortamı içindir).
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: "Parakip — Paran kontrolünde.",
  description: "Kişisel ve küçük işletme finansını tek yerden yönet.",
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
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
