/* سوق العراق - Service Worker: إشعارات + الوضع غير المتصل */
const ICON = 'icon-192.png';
const CACHE = 'souq-static-v1';
const CORE = ['./', 'index.html', 'icon-192.png', 'manifest.webmanifest'];
const STATIC_EXT = /\.(?:css|js|png|jpe?g|gif|webp|svg|ico|woff2?|ttf|webmanifest)(?:\?.*)?$/i;

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.allSettled(CORE.map(u => c.add(u))))   // لا يفشل التثبيت إذا غاب ملف
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('souq-static-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const isStatic = req => ['style', 'script', 'image', 'font', 'manifest'].includes(req.destination) || STATIC_EXT.test(req.url);

// Cache First: الملفات الثابتة
async function cacheFirst(req) {
  const hit = await caches.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res && (res.ok || res.type === 'opaque')) {
    const c = await caches.open(CACHE);
    c.put(req, res.clone()).catch(() => {});
  }
  return res;
}

// Network First: الصفحات والبيانات الديناميكية
async function networkFirst(req) {
  try {
    const res = await fetch(req);
    if (res && res.ok) {
      const c = await caches.open(CACHE);
      c.put(req, res.clone()).catch(() => {});
    }
    return res;
  } catch (err) {
    const hit = await caches.match(req, { ignoreSearch: true });
    if (hit) return hit;
    if (req.mode === 'navigate') {
      const page = (await caches.match('index.html')) || (await caches.match('./'));
      if (page) return page;
    }
    return new Response('غير متصل بالإنترنت', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || !req.url.startsWith('http')) return;
  const same = new URL(req.url).origin === self.location.origin;
  if (isStatic(req)) { e.respondWith(cacheFirst(req).catch(() => caches.match(req))); return; }
  if (same) e.respondWith(networkFirst(req));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if ('focus' in c) return c.focus();
      }
      return self.clients.openWindow ? self.clients.openWindow(url) : undefined;
    })
  );
});

self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(
    self.registration.showNotification(d.title || 'سوق العراق', {
      body: d.body || '',
      icon: d.icon || ICON,
      badge: ICON,
      vibrate: [200, 100, 200],
      tag: d.tag || 'souq-push',
      renotify: true,
      dir: 'rtl',
      lang: 'ar',
      data: { url: d.url || './' }
    })
  );
});
