/* =====================================================================
   firebase-messaging-sw.js — سوق العراق (Firebase Cloud Messaging)
   ضع هذا الملف في جذر الموقع بجانب index.html (نفس مجلد sw.js).
   ===================================================================== */

/* ---------- 1) معالج النقر: يُسجَّل قبل تحميل Firebase ليأخذ الأولوية ---------- */
/* يمنع معالج Firebase الافتراضي من فتح نافذة ثانية، ويوجّه حسب data.type */
self.addEventListener('notificationclick', function (event) {
  event.stopImmediatePropagation();
  event.notification.close();

  if (event.action === 'dismiss') return;

  var data = souqExtractData(event.notification);
  event.waitUntil(souqOpenApp(data));
});

/* ---------- 2) تحميل Firebase (نسخة compat المخصصة لـ Service Worker) ---------- */
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyAu-S9U7Sq4tGLF6TgySj9JgZo4LkCDJpQ",
  authDomain: "doaa-728a6.firebaseapp.com",
  projectId: "doaa-728a6",
  storageBucket: "doaa-728a6.firebasestorage.app",
  messagingSenderId: "434063613533",
  appId: "1:434063613533:web:afeefd180f47c9e47837b4",
  measurementId: "G-9TZJ939ZWE"
});

var messaging = firebase.messaging();

/* ---------- 3) الرسائل في الخلفية ---------- */
/* ملاحظة: إذا احتوت الرسالة على payload.notification فإن Firebase يعرضها بنفسه
   (مثل رسائل الاختبار من Firebase Console)، فلا نعرضها هنا مرة ثانية لتفادي التكرار.
   أما الرسائل التي تحتوي payload.data فقط فنعرضها نحن بالتنسيق العربي الكامل. */
messaging.onBackgroundMessage(function (payload) {
  var n = payload.notification || null;
  var d = payload.data || {};

  if (n) return; // يعرضها Firebase تلقائياً

  var type = souqType(d.type);
  var title = d.title || 'سوق العراق';
  var body = d.body || '';
  var tag = d.tag || ('souq-' + (type || 'general') + '-' + (d.id || d.adId || d.gid || ''));

  return self.registration.showNotification(title, {
    body: body,
    icon: d.icon || 'icon-192.png',
    badge: 'icon-192.png',
    tag: tag,
    renotify: true,
    vibrate: [200, 100, 200],
    dir: 'rtl',
    lang: 'ar',
    data: d,
    actions: [
      { action: 'open', title: 'فتح' },
      { action: 'dismiss', title: 'إغلاق' }
    ]
  });
});

/* ---------- 4) دوال مساعدة ---------- */
var SOUQ_TYPES = ['chat', 'group', 'ad'];

function souqType(t) {
  t = String(t || '').toLowerCase();
  return SOUQ_TYPES.indexOf(t) !== -1 ? t : '';
}

function souqClean(v) {
  return String(v == null ? '' : v).slice(0, 120);
}

/* استخراج data سواء عرضها Firebase (داخل FCM_MSG) أو عرضناها نحن */
function souqExtractData(notification) {
  var nd = (notification && notification.data) || {};
  var d = (nd.FCM_MSG && nd.FCM_MSG.data) ? nd.FCM_MSG.data : nd;
  return {
    type: souqType(d.type),
    id: souqClean(d.id || d.adId || d.chatId || d.gid || d.groupId),
    peer: souqClean(d.peer || d.peerId)
  };
}

/* رابط فتح التطبيق: قيم محددة فقط (لا روابط خارجية) */
function souqBuildUrl(data) {
  var u = new URL('./', self.location.href);
  if (data.type) {
    u.searchParams.set('fcm_type', data.type);
    if (data.id) u.searchParams.set('fcm_id', data.id);
    if (data.peer) u.searchParams.set('fcm_peer', data.peer);
  }
  return u.href;
}

function souqOpenApp(data) {
  return clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      if ('focus' in c) {
        return c.focus().then(function () {
          c.postMessage({ souqFcm: 'click', data: data });
        });
      }
    }
    if (clients.openWindow) return clients.openWindow(souqBuildUrl(data));
  });
}
