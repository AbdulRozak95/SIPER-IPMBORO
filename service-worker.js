/* =======================================================
   SIPER IPM - Service Worker
   Menyimpan file tampilan (HTML/CSS/JS) di cache supaya
   aplikasi tetap bisa dibuka walau koneksi lemah.
   Data surat (dari Google Sheets) TETAP butuh internet,
   karena itu selalu diambil langsung dari server (bukan
   dari cache).
======================================================= */

const CACHE_NAME = "siper-ipm-cache-v2";
const FILE_TERCACHE = [
  "./index.html",
  "./style.css",
  "./script.js",
  "./manifest.json",
  "./icons/icon-192.png",
];

// Simpan file utama ke cache saat pertama kali di-install.
// Pakai cara "satu-satu" (bukan addAll) supaya kalau ada 1 file
// gagal diambil, proses install TETAP lanjut (tidak gagal total).
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        FILE_TERCACHE.map((file) =>
          cache.add(file).catch((err) => {
            console.warn("Gagal cache file:", file, err);
          })
        )
      );
    })
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
      if (cached) return cached;

      return fetch(event.request)
        .then((response) => {
          // Hanya cache respons yang valid (status 200, tipe basic/cors)
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          }
          return response;
        })
        .catch(() => {
          // Offline & tidak ada di cache -> biarkan browser tampilkan error biasa
          return new Response("Offline dan file belum tersimpan di cache.", {
            status: 503,
            statusText: "Offline",
          });
        });
    })
  );
});
