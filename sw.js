/* SIPATIR — Service Worker (cache-first untuk shell aplikasi) */
'use strict';

const CACHE = 'sipatir-v1.2.0';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/data.js',
  './js/camera.js',
  './js/map.js',
  './js/rapor.js',
  './js/app.js',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/maskable-512.png',
  './assets/icons/apple-touch-icon.png',
  './assets/avatars/pengamat.png',
  './assets/avatars/ppa.png',
  './assets/avatars/pekarya.png',
  './assets/avatars/resmi-pengamat.png',
  './assets/avatars/resmi-ppa.png',
  './assets/avatars/resmi-pekarya.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS).catch(() => null)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Permintaan lintas origin (tile peta, CDN) → jaringan saja, jangan di-cache.
  if (url.origin !== location.origin) return;

  // Navigasi halaman: coba jaringan, jatuh ke cache.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put('./index.html', copy));
        return res;
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Aset lain: cache-first.
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
      return res;
    }).catch(() => hit))
  );
});
