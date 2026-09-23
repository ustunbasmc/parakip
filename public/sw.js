/*
 * Parakip service worker — yalnızca "uygulama kabuğu" (1. kademe).
 *
 * NE SAKLANIR:
 *   - /_next/static/*  (içerik karmalı JS/CSS/yazı tipi; değişmez dosyalar)
 *   - /brand/*, ikon ve manifest dosyaları
 *   - /offline (kullanıcı verisi içermeyen statik çevrimdışı sayfası)
 *
 * NE SAKLANMAZ (bilinçli):
 *   - Uygulama sayfalarının HTML'i ve RSC yanıtları — bunlar kullanıcının
 *     finansal verisini içerir; cihazda saklanmaz.
 *   - /api/*, Supabase ve diğer tüm çapraz-kaynak istekler, GET dışı istekler.
 *
 * Sayfa gezintisi ağ başarısız olursa /offline gösterilir. Uygulama içi
 * (RSC) gezintilerde yeniden deneme işini Next.js'in useOffline özelliği
 * yapar; service worker bunlara karışmaz.
 */
const VERSION = "v1";
const STATIC_CACHE = `parakip-static-${VERSION}`;
const SHELL_CACHE = `parakip-shell-${VERSION}`;
const OFFLINE_URL = "/offline";
const PRECACHE = [OFFLINE_URL, "/brand/icon-192.png", "/brand/icon-512.png", "/favicon.ico"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE.map((url) => new Request(url, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("parakip-") && key !== STATIC_CACHE && key !== SHELL_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/brand/") ||
    url.pathname === "/favicon.ico"
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // Değişmez statik dosyalar: önce önbellek, yoksa ağdan alıp sakla.
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      })
    );
    return;
  }

  // Tam sayfa gezintisi: her zaman ağ; ağ yoksa çevrimdışı sayfası.
  // Sayfa HTML'i (finansal veri) önbelleğe YAZILMAZ.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(SHELL_CACHE);
        return (await cache.match(OFFLINE_URL)) || Response.error();
      })
    );
  }
});
