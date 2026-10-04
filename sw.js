/* ============================================================
   Service Worker - سوق العراق الإصدار: souq-v5 - تم التحديث
   ============================================================ */
const CACHE = 'souq-v5';

const ASSETS = [
  './',
  './index.html',
  './manifest',
  './splash.png',
  './icon-19',
  './icon-51'
];

const BYPASS_HOSTS = [
  'firestore.googleapis.com',
  'firebaseio.com',
  'firebasestorage.googleapis.com',
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com'
];

const STATIC_HOSTS = [
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'cdn.jsdelivr.net',
  'unpkg.com'
];

const STATIC_EXT = /\.(?:css|js|mjs|png|jpe?g|gif|webp|avif|svg|ico|woff2?|ttf|otf|webmanifest)$/i;
const STATIC_DEST = ['style', 'script', 'image', 'font', 'manifest'];
const NAV_TIMEOUT = 4000;

const OFFLINE_HTML = '<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>لا يوجد اتصال</title><style>body{margin:0;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:Tajawal,Tahoma,sans-serif;background:#f5f7fa;color:#222;text-align:center;padding:24px}h1{font-size:22px;margin:0 0 8px}p{margin:0 0 20px;color:#666}button{background:#1976D2;color:#fff;border:0;border-radius:10px;padding:12px 28px;font-size:16px;font-family:inherit}</style></head><body><h1>لا يوجد اتصال بالإنترنت</h1><p>تحقق من اتصالك ثم حاول مرة أخرى.</p><button onclick="location.reload()">إعادة المحاولة</button></body></html>';

function hostMatches(hostname, list) {
  return list.some(h => hostname === h || hostname.endsWith('.' + h));
}
function cacheable(res) {
  return res && (res.ok || res.type === 'opaque');
}
async function putInCache(request, response) {
  try {
    const cache = await caches.open(CACHE);
    await cache.put(request, response);
  } catch (err) {}
}
async function precacheOne(cache, url) {
  try {
    const res = await fetch(new Request(url, { cache: 'reload' }));
    if (cacheable(res)) await cache.put(url, res);
  } catch (err) {
    console.warn('[SW] تعذّر تخزين:', url);
  }
}
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => Promise.all(ASSETS.map(url => precacheOne(cache, url))))
  );
});
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
async function networkFirst(request) {
  try {
    const res = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timeout')), NAV_TIMEOUT);
      fetch(request).then(r => { clearTimeout(timer); resolve(r); }, e => { clearTimeout(timer); reject(e); });
    });
    if (res && res.ok) putInCache(request, res.clone());
    return res;
  } catch (err) {
    const cached = await caches.match(request, { ignoreSearch: true });
    if (cached) return cached;
    const fallback = (await caches.match('./index.html')) || (await caches.match('./'));
    if (fallback) return fallback;
    return new Response(OFFLINE_HTML, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
}
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
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  if (hostMatches(url.hostname, BYPASS_HOSTS)) return;
  const isHTML = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');
  if (isHTML) {
    event.respondWith(networkFirst(req));
    return;
  }
  const isStatic = STATIC_DEST.includes(req.destination) || STATIC_EXT.test(url.pathname) || hostMatches(url.hostname, STATIC_HOSTS);
  if (isStatic) {
    event.respondWith(cacheFirst(req));
    return;
  }
});
self.addEventListener('message', event => {
  const d = event.data;
  const type = typeof d === 'string' ? d : (d && (d.type || d.message || d.action));
  if (type === 'SKIP_WAITING') { self.skipWaiting(); return; }
});
