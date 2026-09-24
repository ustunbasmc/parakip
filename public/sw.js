/*
 * Parakip service worker — uygulama kabuğu ve çevrimdışı görünüm.
 *
 * NE SAKLANIR:
 *   - /_next/static/*  (içerik karmalı JS/CSS/yazı tipi; değişmez dosyalar)
 *   - /brand/*, ikon ve manifest dosyaları
 *   - /offline (kullanıcı verisi içermeyen statik çevrimdışı sayfası) ve
 *     onun JS/CSS dosyaları — çevrimdışı görünüm internetsiz de çalışsın diye.
 *     Finansal özet bu önbellekte DEĞİL, tarayıcının IndexedDB'sinde
 *     (bkz. src/lib/offline/snapshotStore.ts) oturum sahibine bağlı tutulur.
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
// /offline sayfası değiştiğinde SHELL_VERSION artırılmalı (yeni kurulum tetiklenir).
// Statik dosyalar içerik karmalı olduğu için onların önbellek adı sabit kalır.
const SHELL_VERSION = "v2";
const STATIC_CACHE = "parakip-static-v1";
const SHELL_CACHE = `parakip-shell-${SHELL_VERSION}`;
const OFFLINE_URL = "/offline";
const PRECACHE = [OFFLINE_URL, "/brand/icon-192.png", "/brand/icon-512.png", "/favicon.ico"];

/** /offline HTML'inin başvurduğu /_next/static dosyalarını da önbelleğe alır. */
async function precacheOfflineAssets() {
  const shell = await caches.open(SHELL_CACHE);
  await shell.addAll(PRECACHE.map((url) => new Request(url, { cache: "reload" })));
  const page = await shell.match(OFFLINE_URL);
  if (!page) return;
  const html = await page.text();
  const assets = [...new Set(html.match(/\/_next\/static\/[^"'\s)]+/g) || [])];
  const staticCache = await caches.open(STATIC_CACHE);
  await Promise.all(
    assets.map((url) =>
      staticCache.match(url).then((hit) => hit || fetch(url).then((res) => (res.ok ? staticCache.put(url, res) : undefined)))
    )
  ).catch(() => undefined);
}

self.addEventListener("install", (event) => {
  event.waitUntil(precacheOfflineAssets().then(() => self.skipWaiting()));
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

// ───────── Anlık bildirimler (web push) ─────────
// Yük: { title, body, url, tag } — sunucu kullanıcı "ayrıntıları gizle"
// dediyse tutar içermeyen genel bir metin gönderir (bkz. src/lib/push/send.ts).
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Parakip";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      tag: data.tag,
      icon: "/brand/icon-192.png",
      badge: "/brand/icon-192.png",
      data: { url: typeof data.url === "string" && data.url.startsWith("/") ? data.url : "/notifications" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/notifications", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (new URL(client.url).origin === self.location.origin && "focus" in client) {
          return client.focus().then((c) => (c && "navigate" in c ? c.navigate(target) : undefined));
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
