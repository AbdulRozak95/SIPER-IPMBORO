/* =======================================================
   SIPER IPM - Service Worker
   Menyimpan file tampilan (HTML/CSS/JS) di cache supaya
   aplikasi tetap bisa dibuka walau koneksi lemah.
   Data surat (dari Google Sheets) TETAP butuh internet,
   karena itu selalu diambil langsung dari server (bukan
   dari cache).
======================================================= */

const CACHE_NAME = "siper-ipm-cache-v1";
const FILE_TERCACHE = [
  "./index.html",
  "./style.css",
  "./script.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

// Simpan file utama ke cache saat pertama kali di-install
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(FILE_TERCACHE))
  );
  self.skipWaiting();
});

// Bersihkan cache versi lama saat ada update
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

// Strategi: file statis (html/css/js/ikon) pakai cache dulu,
// tapi permintaan ke Google Apps Script (data) selalu ke internet langsung.
self.addEventListener("fetch", (event) => {
  const url = event.request.url;

  // Jangan cache permintaan ke API (Google Apps Script) atau CDN eksternal
  if (url.includes("script.google.com") || url.includes("cdnjs.cloudflare.com")) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      return (
        cached ||
        fetch(event.request).then((response) => {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, response.clone());
            return response;
          });
        })
      );
    })
  );
});
