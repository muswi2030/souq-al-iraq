/* سوق العراق - Service Worker للإشعارات */
const ICON = 'icon-192.png';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(self.clients.claim());
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
