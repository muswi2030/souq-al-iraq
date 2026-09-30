/* ============================================================
   Service Worker - سوق العراق
   الإصدار: souq-v4
   ============================================================ */

const CACHE = 'souq-v4';

/* الملفات المحلية + مكتبات CDN التي تُخزَّن مسبقاً عند التثبيت */
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './splash.png',
  'https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;900&display=swap',
  'https://cdn.jsdelivr.net/npm/lucide@0.454.0/dist/umd/lucide.min.js',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

/* نطاقات Firebase: تُترك للشبكة مباشرة دون أي تدخل من الـ SW */
const BYPASS_HOSTS = [
  'firestore.googleapis.com',
  'firebaseio.com',
  'firebasestorage.googleapis.com',
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com'
];

/* نطاقات تُعامل كملفات ثابتة (خطوط ومكتبات) */
const STATIC_HOSTS = [
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'cdn.jsdelivr.net',
  'unpkg.com'
];

const STATIC_EXT = /\.(?:css|js|mjs|png|jpe?g|gif|webp|avif|svg|ico|woff2?|ttf|otf|webmanifest)$/i;
const STATIC_DEST = ['style', 'script', 'image', 'font', 'manifest'];

/* مهلة انتظار الشبكة لصفحات HTML قبل الرجوع للكاش (بالمللي ثانية) */
const NAV_TIMEOUT = 4000;

/* صفحة "لا يوجد اتصال" تُعرض عند فشل الشبكة والكاش معاً */
const OFFLINE_HTML = '<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8">' +
  '<meta name="viewport" content="width=device-width,initial-scale=1">' +
  '<title>لا يوجد اتصال</title>' +
  '<style>body{margin:0;min-height:100vh;display:flex;flex-direction:column;align-items:center;' +
  'justify-content:center;font-family:Tajawal,Tahoma,sans-serif;background:#f5f7fa;color:#222;text-align:center;padding:24px}' +
  'h1{font-size:22px;margin:0 0 8px}p{margin:0 0 20px;color:#666}' +
  'button{background:#1976D2;color:#fff;border:0;border-radius:10px;padding:12px 28px;font-size:16px;font-family:inherit}' +
  '</style></head><body><h1>لا يوجد اتصال بالإنترنت</h1>' +
  '<p>تحقق من اتصالك ثم حاول مرة أخرى.</p>' +
  '<button onclick="location.reload()">إعادة المحاولة</button></body></html>';

/* ---------- أدوات مساعدة ---------- */

function hostMatches(hostname, list) {
  return list.some(h => hostname === h || hostname.endsWith('.' + h));
}

/* تخزين استجابة صالحة (عادية أو opaque للـ CDN) */
function cacheable(res) {
  return res && (res.ok || res.type === 'opaque');
}

async function putInCache(request, response) {
  try {
    const cache = await caches.open(CACHE);
    await cache.put(request, response);
  } catch (err) {
    /* تجاهل أخطاء الحصة أو الطلبات غير القابلة للتخزين */
  }
}

/* تخزين مسبق لعنصر واحد: فشل أي عنصر لا يُفشل التثبيت كاملاً */
async function precacheOne(cache, url) {
  try {
    const res = await fetch(new Request(url, { cache: 'reload' }));
    if (cacheable(res)) await cache.put(url, res);
  } catch (err) {
    console.warn('[SW] تعذّر تخزين:', url);
  }
}

/* ---------- install ---------- */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache =>
      Promise.all(ASSETS.map(url => precacheOne(cache, url)))
    )
  );
  /* لا نستدعي skipWaiting هنا: التطبيق يطلبه عبر رسالة SKIP_WAITING */
});

/* ---------- activate ---------- */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* ---------- Network First لصفحات HTML ---------- */
async function networkFirst(request) {
  try {
    const res = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timeout')), NAV_TIMEOUT);
      fetch(request).then(r => { clearTimeout(timer); resolve(r); },
                          e => { clearTimeout(timer); reject(e); });
    });
    if (res && res.ok) putInCache(request, res.clone());
    return res;
  } catch (err) {
    const cached = await caches.match(request, { ignoreSearch: true });
    if (cached) return cached;
    const fallback = (await caches.match('./index.html')) || (await caches.match('./'));
    if (fallback) return fallback;
    return new Response(OFFLINE_HTML, {
      status: 503,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }
}

/* ---------- Cache First للملفات الثابتة ---------- */
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const res = await fetch(request);
    if (cacheable(res)) putInCache(request, res.clone());
    return res;
  } catch (err) {
    return new Response('', { status: 504, statusText: 'Offline' });
  }
}

/* ---------- fetch ---------- */
self.addEventListener('fetch', event => {
  const req = event.request;

  /* تجاوز الطلبات غير GET */
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  /* تجاوز ما ليس http(s) (مثل chrome-extension) */
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  /* تجاوز نطاقات Firebase */
  if (hostMatches(url.hostname, BYPASS_HOSTS)) return;

  /* صفحات HTML: الشبكة أولاً */
  const isHTML = req.mode === 'navigate' ||
    (req.headers.get('accept') || '').includes('text/html');
  if (isHTML) {
    event.respondWith(networkFirst(req));
    return;
  }

  /* الملفات الثابتة: الكاش أولاً */
  const isStatic = STATIC_DEST.includes(req.destination) ||
    STATIC_EXT.test(url.pathname) ||
    hostMatches(url.hostname, STATIC_HOSTS);
  if (isStatic) {
    event.respondWith(cacheFirst(req));
    return;
  }

  /* أي شيء آخر (مثل بلاطات الخريطة): يمر للشبكة بلا تدخل */
});

/* ---------- رسائل من التطبيق ---------- */
self.addEventListener('message', event => {
  const d = event.data;
  const type = typeof d === 'string' ? d : (d && (d.type || d.message || d.action));

  if (type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  if (type === 'CHECK_UPDATE') {
    event.waitUntil(
      self.registration.update()
        .then(() => {
          if (event.source) event.source.postMessage({ type: 'UPDATE_CHECKED', cache: CACHE });
        })
        .catch(() => {
          if (event.source) event.source.postMessage({ type: 'UPDATE_FAILED', cache: CACHE });
        })
    );
  }
});

/* ---------- الإشعارات: push ---------- */
self.addEventListener('push', event => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (err) {
      data = { body: event.data.text() };
    }
  }

  const title = data.title || 'سوق العراق';
  const options = {
    body: data.body || '',
    icon: data.icon || './icon-192.png',
    badge: data.badge || './icon-192.png',
    tag: data.tag || undefined,
    dir: 'rtl',
    lang: 'ar',
    data: { url: data.url || './' }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

/* ---------- الإشعارات: notificationclick ---------- */
self.addEventListener('notificationclick', event => {
  event.notification.close();

  const target = new URL(
    (event.notification.data && event.notification.data.url) || './',
    self.registration.scope
  ).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if (client.url.startsWith(self.registration.scope) && 'focus' in client) {
          return client.focus().then(c => {
            if (c && 'navigate' in c && c.url !== target) return c.navigate(target);
            return c;
          });
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
