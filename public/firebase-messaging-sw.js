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

/* Offline-first app shell and static-asset cache.
   Keep this in the same root worker as push notifications: a second root-scope
   worker would replace the notification handler and break push delivery. */
const SHELL_CACHE = 'workly-offline-shell-v2';
const ASSET_CACHE = 'workly-static-assets-v2';
const OFFLINE_URL = '/offline.html';
const MAX_ASSET_ENTRIES = 180;
const BYPASS_PREFIXES = [
  '/rest/', '/auth/', '/storage/', '/functions/', '/realtime/',
  '/api/', '/graphql/', '/_vercel/'
];

function isCacheableAppRequest(request, url) {
  if (url.origin !== self.location.origin) return false;
  if (BYPASS_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) return false;
  if (url.pathname === '/firebase-messaging-sw.js' || url.pathname === '/offline.html') return false;
  if (request.headers.has('authorization')) return false;
  if (request.headers.get('accept')?.includes('application/json')) return false;
  return ['script', 'style', 'image', 'font', 'worker'].includes(request.destination);
}

async function trimAssetCache(cache) {
  const keys = await cache.keys();
  if (keys.length <= MAX_ASSET_ENTRIES) return;
  await Promise.all(keys.slice(0, keys.length - MAX_ASSET_ENTRIES).map((key) => cache.delete(key)));
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(req);
        if (response && response.ok) {
          const cache = await caches.open(SHELL_CACHE);
          await cache.put(req, response.clone());
          // Preserve the canonical SPA entry point as the offline navigation fallback.
          if (url.pathname === '/') await cache.put('/', response.clone());
        }
        return response;
      } catch (_error) {
        const cache = await caches.open(SHELL_CACHE);
        return (await cache.match(req)) ||
          (await cache.match('/')) ||
          (await caches.match(OFFLINE_URL)) ||
          Response.error();
      }
    })());
    return;
  }

  if (!isCacheableAppRequest(req, url)) return;
  event.respondWith((async () => {
    const cache = await caches.open(ASSET_CACHE);
    const cached = await cache.match(req);
    const network = fetch(req).then(async (response) => {
      if (response && response.ok && response.type !== 'opaque') {
        await cache.put(req, response.clone());
        await trimAssetCache(cache);
      }
      return response;
    });
    if (cached) {
      event.waitUntil(network.catch(() => undefined));
      return cached;
    }
    try {
      return await network;
    } catch (_error) {
      return cached || Response.error();
    }
  })());
});

async function precacheAppShell() {
  const shellCache = await caches.open(SHELL_CACHE);
  const assetCache = await caches.open(ASSET_CACHE);

  // Cache the app entry and the dedicated offline screen first.
  const shellResponse = await fetch('/');
  if (shellResponse.ok) {
    await shellCache.put('/', shellResponse.clone());

    // Vite emits hashed JS/CSS files and modulepreload links in index.html.
    // Pre-cache these on the first install so the app can start offline even
    // if the user switches mobile data off immediately after opening it.
    const html = await shellResponse.clone().text();
    const matches = html.matchAll(/(?:src|href)=["']([^"'<>]+\.(?:js|css)(?:\?[^"'<>]*)?)["']/gi);
    const assets = new Set();
    for (const match of matches) {
      try {
        const assetUrl = new URL(match[1], self.location.origin);
        if (assetUrl.origin === self.location.origin) assets.add(assetUrl.href);
      } catch (_error) {
        // Ignore malformed or external URLs.
      }
    }

    await Promise.all(Array.from(assets).map(async (assetUrl) => {
      try {
        const response = await fetch(assetUrl);
        if (response.ok && response.type !== 'opaque') {
          await assetCache.put(assetUrl, response);
        }
      } catch (_error) {
        // One optional chunk failing must not prevent the offline shell install.
      }
    }));
    await trimAssetCache(assetCache);
  }

  try {
    const offlineResponse = await fetch(OFFLINE_URL);
    if (offlineResponse.ok) await shellCache.put(OFFLINE_URL, offlineResponse);
  } catch (_error) {
    // The shell still works if the optional fallback page is unavailable.
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(precacheAppShell().catch(() => undefined));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((key) => (key.startsWith('workly-offline-shell-') && key !== SHELL_CACHE) ||
                       (key.startsWith('workly-static-assets-') && key !== ASSET_CACHE))
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});
