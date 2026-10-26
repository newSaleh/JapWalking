// Bump VERSION on every change so installed apps pick up the update automatically.
const VERSION = '5';
const CACHE = 'jw-' + VERSION;
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icons/apple-touch-icon.png', './icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('install', (e) => {
  // cache: 'reload' skips the HTTP cache so a new version never stores stale files
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === location.origin;
  const allowed = sameOrigin || /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!allowed) return;

  // The page: always try the network first (bypassing the HTTP cache), fall back to the cached copy offline
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req.url, { cache: 'no-store' })
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put('./index.html', copy));
          }
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Own files: cached copy from this version. Fonts: stale-while-revalidate.
  e.respondWith(
    caches.match(req).then((hit) => {
      if (hit && sameOrigin) return hit;
      const net = fetch(req)
        .then((res) => {
          if (res.ok || res.type === 'opaque') {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => hit);
      return hit || net;
    })
  );
});
