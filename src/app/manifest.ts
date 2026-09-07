import type { MetadataRoute } from "next";

/**
 * "Ana ekrana ekle" (PWA) desteği için — kullanıcı Parakip'i telefonuna
 * eklediğinde gerçek marka ikonu ve marka rengiyle açılır (jenerik
 * tarayıcı ikonu yerine).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Parakip — Paran kontrolünde",
    short_name: "Parakip",
    description: "Türkçe, TL tabanlı kişisel ve küçük işletme finans uygulaması.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a1120",
    theme_color: "#0d9488",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
