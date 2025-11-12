/* eslint-disable no-restricted-globals */
// Basic app shell + API caching with versioning
const VERSION = 'v1';
const APP_SHELL_CACHE = `app-shell-${VERSION}`;
const RUNTIME_CACHE = `runtime-${VERSION}`;

const APP_SHELL_URLS = [
  '/', // root
  '/favicon.ico',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then((cache) => cache.addAll(APP_SHELL_URLS)).catch(() => {})
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => ![APP_SHELL_CACHE, RUNTIME_CACHE].includes(k))
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

// Cache-first for app shell/static; network-first for JSON/API
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET') return; // only GET

  // Same-origin navigation or static
  if (url.origin === self.location.origin) {
    if (req.mode === 'navigate' || APP_SHELL_URLS.includes(url.pathname)) {
      event.respondWith(
        caches.match(req).then((cached) => {
          return (
            cached ||
            fetch(req)
              .then((resp) => {
                const copy = resp.clone();
                caches.open(APP_SHELL_CACHE).then((cache) => cache.put(req, copy));
                return resp;
              })
              .catch(() => cached || caches.match('/'))
          );
        })
      );
      return;
    }
  }

  // Network-first for JSON/API responses
  const isApi = url.pathname.startsWith('/api/') || url.hostname.endsWith('supabase.co');
  if (isApi) {
    event.respondWith(
      (async () => {
        try {
          const resp = await fetch(req);
          const copy = resp.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(req, copy));
          return resp;
        } catch {
          const cached = await caches.match(req);
          if (cached) return cached;
          throw new Error('Network error and no cache');
        }
      })()
    );
  }
});

/* global self, clients */
// Basic Service Worker for Web Push handling, actions, and deep links
// Install/activate lifecycle: take control ASAP
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Handle incoming push events
// Expected payload (JSON):
// {
//   "title": "Task updated",
//   "body": "Task #123 was updated",
//   "icon": "/icons/icon-192.png",
//   "badge": "/icons/badge-72.png",
//   "tag": "task-123",
//   "actions": [{ "action": "open", "title": "פתח" }],
//   "data": { "url": "/driver/tasks/<id>", "taskId": "<id>" }
// }
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    // non-JSON or missing payload; default to empty
    payload = {};
  }

  const title = payload.title || 'התראה חדשה';
  const body = payload.body || '';
  const icon = payload.icon || '/icons/icon-192.png';
  const badge = payload.badge || '/icons/badge-72.png';
  const tag = payload.tag;
  const actions = Array.isArray(payload.actions) ? payload.actions : undefined;
  const data = payload.data || {};

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge,
      tag,
      data,
      actions,
      vibrate: [50, 50],
      dir: 'rtl',
      lang: 'he-IL',
      renotify: !!tag,
    })
  );
});

// Focus or open the app to a deep link on click
self.addEventListener('notificationclick', (event) => {
  const notification = event.notification;
  const action = event.action;
  notification.close();

  const url =
    (notification.data && (notification.data.url || notification.data.route)) || '/';

  event.waitUntil(
    (async () => {
      const windowClients = await clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      // Try to focus an existing client
      for (const client of windowClients) {
        try {
          // If the client is already open, focus it and navigate
          await client.focus?.();
          // Prefer navigate when available
          if (client.navigate) {
            await client.navigate(url);
          } else {
            await clients.openWindow(url);
          }
          return;
        } catch {
          // ignore and try next
        }
      }

      // Otherwise, open a new window
      await clients.openWindow(url);
    })()
  );
});


