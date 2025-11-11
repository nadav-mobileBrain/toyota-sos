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


