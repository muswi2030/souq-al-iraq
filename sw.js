/* =========================================
   سوق العراق - Service Worker (الإصدار المحدّث)
   متوافق مع index.html الجديد (v4)
   ========================================= */

const CACHE = 'souq-v2';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png'
];

/* نطاقات لا يجب تخزينها (Firebase وطلبات ديناميكية) */
const BYPASS_HOSTS = [
  'firestore.googleapis.com',
  'firebaseio.com',
  'firebasestorage.googleapis.com',
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
  'googleapis.com'
];

const STATIC_RE = /\.(?:css|js|mjs|png|jpe?g|gif|webp|avif|svg|ico|woff2?|ttf|otf)(?:\?.*)?$/i;

/* ---------- التثبيت ---------- */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache =>
        cache.addAll(ASSETS).catch(() =>
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
      .then(keys => Promise.all(
        keys.filter(k => !k.startsWith(CACHE)).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

/* ---------- أدوات مساعدة ---------- */
const isHTML = req =>
  req.mode === 'navigate' ||
  (req.headers.get('accept') || '').includes('text/html');

const isStatic = req =>
  ['style', 'script', 'image', 'font'].includes(req.destination) ||
  STATIC_RE.test(new URL(req.url).pathname);

const isBypass = url => {
  try {
    const host = new URL(url).hostname;
    return BYPASS_HOSTS.some(h => host.includes(h));
  } catch (e) { return false; }
};

/* Cache First: للملفات الثابتة */
async function cacheFirst(req) {
  const hit = await caches.match(req);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res && (res.ok || res.type === 'opaque')) {
      const cache = await caches.open(CACHE);
      cache.put(req, res.clone()).catch(() => {});
    }
    return res;
  } catch (err) {
    return caches.match(req).then(r => r || Response.error());
  }
}

/* Network First: لصفحات HTML */
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
      new Response(
        '<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>غير متصل</title></head><body style="font-family:sans-serif;text-align:center;padding:40px"><h1>⚠️ أنت غير متصل بالإنترنت</h1><p>تحقق من اتصالك ثم أعد المحاولة</p><button onclick="location.reload()" style="padding:12px 24px;background:#007bff;color:#fff;border:0;border-radius:8px;font-size:16px;cursor:pointer">إعادة المحاولة</button></body></html>',
        {
          status: 503,
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        }
      )
    );
  }
}

/* ---------- اعتراض الطلبات ---------- */
self.addEventListener('fetch', event => {
  const req = event.request;

  // تجاوز غير GET
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // تجاوز البروتوكولات غير HTTP
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // تجاوز Firebase والطلبات الديناميكية
  if (isBypass(req.url)) return;

  // HTML: Network First
  if (isHTML(req)) {
    event.respondWith(networkFirst(req));
    return;
  }

  // الملفات الثابتة: Cache First
  if (isStatic(req)) {
    event.respondWith(cacheFirst(req));
  }
});

/* ---------- الإشعارات: النقر ---------- */
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || './';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      // إذا كان هناك نافذة مفتوحة، ركّز عليها
      for (const client of list) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // وإلا افتح نافذة جديدة
      return self.clients.openWindow ? self.clients.openWindow(target) : undefined;
    })
  );
});

/* ---------- الإشعارات: Push من الخادم (اختياري) ---------- */
self.addEventListener('push', event => {
  let d = {};
  try {
    d = event.data ? event.data.json() : {};
  } catch (e) {
    d = { body: event.data ? event.data.text() : '' };
  }
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

/* ---------- رسائل من التطبيق ---------- */
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'CHECK_UPDATE') {
    self.registration.update();
  }
});
