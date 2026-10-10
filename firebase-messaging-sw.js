/* ============================================================
   🔔 Firebase Cloud Messaging — Service Worker
   يعمل بالتوازي مع sw.js الرئيسي
   ============================================================ */

// استيراد Firebase (compat mode للـ Service Worker)
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// ═══════════════════════════════════════════════════════════
// إعدادات Firebase
// ═══════════════════════════════════════════════════════════
firebase.initializeApp({
  apiKey: "AIzaSyAu-S9U7Sq4tGLF6TgySj9JgZo4LkCDJpQ",
  authDomain: "doaa-728a6.firebaseapp.com",
  projectId: "doaa-728a6",
  storageBucket: "doaa-728a6.firebasestorage.app",
  messagingSenderId: "434063613533",
  appId: "1:434063613533:web:afeefd180f47c9e47837b4"
});

const messaging = firebase.messaging();

// ═══════════════════════════════════════════════════════════
// استقبال الإشعارات في الخلفية (التطبيق مغلق)
// ═══════════════════════════════════════════════════════════
messaging.onBackgroundMessage((payload) => {
  console.log('[FCM-SW] 📩 إشعار في الخلفية:', payload);

  const notification = payload.notification || {};
  const data = payload.data || {};

  const title = notification.title || 'سوق العراق';
  const options = {
    body: notification.body || 'لديك إشعار جديد',
    icon: notification.icon || 'icon-192.png',
    badge: notification.badge || 'icon-192.png',
    vibrate: [200, 100, 200],
    tag: data.tag || 'souq-general',
    renotify: true,
    requireInteraction: false,
    dir: 'rtl',
    lang: 'ar',
    data: data
  };

  // أزرار تفاعلية حسب النوع
  if (data.type === 'chat') {
    options.actions = [
      { action: 'open', title: 'فتح المحادثة' },
      { action: 'dismiss', title: 'تجاهل' }
    ];
  } else if (data.type === 'group') {
    options.actions = [
      { action: 'open', title: 'فتح المجموعة' },
      { action: 'dismiss', title: 'تجاهل' }
    ];
  } else if (data.type === 'ad_approved') {
    options.actions = [
      { action: 'open', title: 'عرض إعلاني' }
    ];
  }

  return self.registration.showNotification(title, options);
});

// ═══════════════════════════════════════════════════════════
// عند الضغط على الإشعار
// ═══════════════════════════════════════════════════════════
self.addEventListener('notificationclick', (event) => {
  console.log('[FCM-SW] 👆 تم الضغط على الإشعار');
  event.notification.close();

  const data = event.notification.data || {};
  const action = event.action;

  if (action === 'dismiss') return;

  // تحديد الرابط المستهدف
  let targetUrl = data.url || './';
  if (data.type === 'chat' && data.chatId) {
    targetUrl = './?chat=' + data.chatId;
  } else if (data.type === 'group' && data.groupId) {
    targetUrl = './?g=' + data.groupId;
  } else if (data.type === 'ad' && data.adId) {
    targetUrl = './#ad' + data.adId;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // إن كان التطبيق مفتوحاً، ركّز عليه
        for (const client of clientList) {
          if ('focus' in client) {
            client.focus();
            if ('navigate' in client) {
              return client.navigate(targetUrl);
            }
            return;
          }
        }
        // وإلا افتح نافذة جديدة
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
  );
});

// ═══════════════════════════════════════════════════════════
// استقبال رسائل من الصفحة الرئيسية (اختياري)
// ═══════════════════════════════════════════════════════════
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
