const CACHE_NAME = "siper-ipm-cache-v24";
const FILE_TERCACHE = [
  "./index.html",
  "./style.css",
  "./script.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
  "./icons/logo-app.png",
  "./icons/splash-icon-192.png",
  "./icons/splash-icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE_NAME);
        // Cache file satu-satu, jangan gunakan addAll (lebih permisif)
        for (const file of FILE_TERCACHE) {
          try {
            await cache.add(file);
          } catch (err) {
            console.warn("Skip cache:", file, err);
          }
        }
      } catch (err) {
        console.error("Cache setup error:", err);
      }
    })()
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = event.request.url;

  if (url.includes("script.google.com") || url.includes("cdnjs.cloudflare.com")) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          }
          return response;
        })
        .catch(() => {
          return new Response("Offline dan file belum tersimpan di cache.", {
            status: 503,
            statusText: "Offline",
          });
        });
    })
  );
});
