/* سوق العراق - Service Worker */
const CACHE = 'souq-v1';
const ASSETS = ['./', './index.html', './icon-192.png', './manifest.webmanifest'];
const STATIC_RE = /\.(?:css|js|mjs|png|jpe?g|gif|webp|avif|svg|ico|woff2?|ttf|otf)(?:\?.*)?$/i;

/* ---------- التثبيت ---------- */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache =>
        cache.addAll(ASSETS).catch(() =>
          // إذا غاب ملف واحد (مثل الأيقونة) لا نفشل التثبيت كله
          Promise.allSettled(ASSETS.map(u => cache.add(u)))
        )
      )
      .then(() => self.skipWaiting())
  );
});

/* ---------- التفعيل ---------- */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => !k.startsWith(CACHE)).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* ---------- الاعتراض ---------- */
const isHTML = req =>
  req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');

const isStatic = req =>
  ['style', 'script', 'image', 'font'].includes(req.destination) || STATIC_RE.test(new URL(req.url).pathname);

// Cache First: CSS / JS / صور / خطوط
async function cacheFirst(req) {
  const hit = await caches.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res && (res.ok || res.type === 'opaque')) {
    const cache = await caches.open(CACHE);
    cache.put(req, res.clone()).catch(() => {});
  }
  return res;
}

// Network First: صفحات HTML، مع الرجوع للنسخة المخزنة عند فشل الاتصال
async function networkFirst(req) {
  try {
    const res = await fetch(req);
    if (res && res.ok) {
      const cache = await caches.open(CACHE);
      cache.put(req, res.clone()).catch(() => {});
    }
    return res;
  } catch (err) {
    return (
      (await caches.match(req)) ||
      (await caches.match('./index.html')) ||
      (await caches.match('./')) ||
      new Response('أنت غير متصل بالإنترنت', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      })
    );
  }
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;                         // تجاوز غير GET
  const url = new URL(req.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return; // تجاوز chrome-extension وغيرها
  if (isHTML(req)) {
    event.respondWith(networkFirst(req));
  } else if (isStatic(req)) {
    event.respondWith(cacheFirst(req).catch(() => caches.match(req)));
  }
});

/* ---------- الإشعارات ---------- */
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || './';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if ('focus' in client) return client.focus();
      }
      return self.clients.openWindow ? self.clients.openWindow(target) : undefined;
    })
  );
});

// هيكل استقبال Push من الخادم (اختياري)
self.addEventListener('push', event => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; }
  catch (e) { d = { body: event.data ? event.data.text() : '' }; }
  event.waitUntil(
    self.registration.showNotification(d.title || 'سوق العراق', {
      body: d.body || '',
      icon: d.icon || './icon-192.png',
      badge: './icon-192.png',
      vibrate: [200, 100, 200],
      tag: d.tag || 'souq-push',
      renotify: true,
      dir: 'rtl',
      lang: 'ar',
      data: { url: d.url || './' }
    })
  );
});
