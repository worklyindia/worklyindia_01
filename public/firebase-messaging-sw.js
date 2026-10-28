/* Web Push service worker (native Push API handling).

   We deliberately do NOT load the Firebase Messaging SDK here. The compat SDK
   installs its own `push` listener whose promise is not always kept alive by
   Chrome on Android, which makes the browser fall back to the generic
   "This site has been updated in the background" notification and drops the
   rich image/action payload. Handling the raw `push` event ourselves works the
   same way on Chrome, Edge, Firefox, Opera, Samsung Internet and Safari 16.4+.
*/

const params = Object.fromEntries(new URL(self.location).searchParams);
const FALLBACK_ICON = '/icons/icon-192x192.png';

const toAbsolute = (u) => {
  if (!u) return undefined;
  try {
    return new URL(u, self.location.origin).href;
  } catch (_e) {
    return undefined;
  }
};

function readPayload(event) {
  if (!event.data) return {};
  try {
    return event.data.json() || {};
  } catch (_e) {
    try {
      return { data: { body: event.data.text() } };
    } catch (_e2) {
      return {};
    }
  }
}

function buildNotification(payload) {
  // FCM delivers either { data: {...} } (data-only) or { notification: {...} }.
  const data = payload.data || {};
  const notification = payload.notification || {};
  const fcmOptions = payload.fcmOptions || payload.fcm_options || {};

  const title = notification.title || data.title || 'Workly India';

  let actions = [];
  try {
    const raw = data.actions || data.buttons;
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    actions = Array.isArray(parsed) ? parsed : [];
  } catch (_e) {
    actions = [];
  }
  actions = actions
    .map((a) => ({
      action: String(a.action || a.id || 'open'),
      title: String(a.title || a.text || 'Open'),
      url: a.url,
      icon: toAbsolute(a.icon),
    }))
    .filter((a) => a.title);

  const image = toAbsolute(data.image || data.big_picture || notification.image);
  const url = data.url || fcmOptions.link || notification.click_action || '/';

  const options = {
    body: notification.body || data.body || '',
    icon: data.type === 'whatsapp_message'
      ? toAbsolute(data.icon || '/whatsapp-notification-icon.png?v=2')
      : toAbsolute(notification.icon || data.icon || params.brandIcon) || FALLBACK_ICON,
    // Restored custom badge at the owner's request. Android controls its tint.
    // Reversible Chrome-icon test: omit only this badge property again.
    badge: toAbsolute(params.badge) || '/icons/workly-notification-logo.png',
    data: {
      url,
      actionUrls: actions.reduce((acc, a) => {
        if (a && a.action) acc[a.action] = a.url || url;
        return acc;
      }, {}),
    },
    tag: data.tag || notification.tag || undefined,
    renotify: Boolean(data.tag || notification.tag),
    requireInteraction: data.requireInteraction === 'true',
    timestamp: Date.now(),
  };

  // `image` and `actions` are unsupported on Firefox/Safari; setting them there
  // is harmless but we only add them when the browser advertises support.
  if (image && 'image' in Notification.prototype) options.image = image;
  if (actions.length && 'actions' in Notification.prototype) {
    options.actions = actions.slice(0, 2).map((a) => ({
      action: a.action,
      title: a.title,
      icon: a.icon || undefined,
    }));
  }

  return { title, options };
}

self.addEventListener('push', (event) => {
  const payload = readPayload(event);
  const { title, options } = buildNotification(payload);
  // Keeping the push event alive until showNotification resolves is what stops
  // Chrome from replacing it with its generic background-update notification.
  event.waitUntil(
    self.registration.showNotification(title, options).catch(() =>
      // Retry without the optional banner, but retain badge and action routing.
      self.registration.showNotification(title, { ...options, image: undefined, icon: FALLBACK_ICON }),
    ),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const nd = event.notification.data || {};
  const target =
    (event.action && nd.actionUrls && nd.actionUrls[event.action]) || nd.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          if ('navigate' in client) client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});

/* Keep the push subscription alive when the browser rotates it. */
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      clients.forEach((c) => c.postMessage({ type: 'PUSH_SUBSCRIPTION_CHANGE' }));
    }),
  );
});

/* Offline fallback (previously handled by the removed /sw.js worker). */
const CACHE = 'app-shell-v1';
const OFFLINE_URL = '/offline.html';

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || req.mode !== 'navigate') return;
  event.respondWith(
    fetch(req).catch(() => caches.match(OFFLINE_URL).then((r) => r || Response.error())),
  );
});

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll([OFFLINE_URL])).catch(() => undefined),
  );
  self.skipWaiting();
});
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
