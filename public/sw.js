/* eslint-disable no-restricted-globals */
// Basic app shell + API caching with versioning
const VERSION = 'v4'; // Bumped version for realtime + polling fallback
const APP_SHELL_CACHE = `app-shell-${VERSION}`;
const RUNTIME_CACHE = `runtime-${VERSION}`;

const APP_SHELL_URLS = [
  '/', // root
  '/favicon.ico',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches
      .open(APP_SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL_URLS))
      .catch(() => {})
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

// Strategy: Network First for navigation (HTML), Cache First for static assets
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (req.method !== 'GET') return;

  // Same-origin requests
  if (url.origin === self.location.origin) {
    // 1. Navigation requests (HTML): Network First, falling back to cache
    if (req.mode === 'navigate') {
      event.respondWith(
        fetch(req)
          .then((resp) => {
            // Update cache with fresh version
            const copy = resp.clone();
            caches.open(APP_SHELL_CACHE).then((cache) => cache.put(req, copy));
            return resp;
          })
          .catch(() => {
            // Fallback to cache if offline
            return caches
              .match(req)
              .then((cached) => cached || caches.match('/'));
          })
      );
      return;
    }

    // 2. Static assets (JS, CSS, Images): Cache First, falling back to network
    // We assume hashed filenames (Next.js default), so cache is safe
    if (
      url.pathname.startsWith('/_next/static/') ||
      APP_SHELL_URLS.includes(url.pathname)
    ) {
      event.respondWith(
        caches.match(req).then((cached) => {
          return (
            cached ||
            fetch(req).then((resp) => {
              const copy = resp.clone();
              caches
                .open(APP_SHELL_CACHE)
                .then((cache) => cache.put(req, copy));
              return resp;
            })
          );
        })
      );
      return;
    }
  }

  // Network-first for JSON/API responses
  const isApi =
    url.pathname.startsWith('/api/') || url.hostname.endsWith('supabase.co');
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

// ---- Background Sync & Manual Sync ----
async function idbOpen() {
  return await new Promise((resolve, reject) => {
    const req = indexedDB.open('toyota-sos', 1);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbAll(db, store) {
  return await new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const s = tx.objectStore(store);
    const getReq = s.getAll();
    getReq.onsuccess = () => resolve(getReq.result || []);
    getReq.onerror = () => reject(getReq.error);
  });
}
async function idbUpdate(db, store, obj) {
  return await new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const s = tx.objectStore(store);
    const req = s.put(obj);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}
async function idbDelete(db, store, id) {
  return await new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const s = tx.objectStore(store);
    const req = s.delete(id);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

function computeBackoffMs(retryCount, base = 1000, jitter = 500) {
  const pow = Math.pow(2, retryCount);
  return base * pow + Math.floor(Math.random() * jitter);
}

async function processStore(db, store, sender, now, maxRetries = 5) {
  const items = await idbAll(db, store);
  for (const it of items) {
    const nextAt = it.nextAttemptAt || 0;
    if (nextAt > now) continue;
    try {
      it.status = 'sending';
      await idbUpdate(db, store, it);
      await sender(it);
      await idbDelete(db, store, it.id);
      broadcast({ type: 'sync:success', store, id: it.id });
    } catch (e) {
      const retry = (it.retryCount || 0) + 1;
      if (retry > maxRetries) {
        it.status = 'failed';
        it.retryCount = retry;
        await idbUpdate(db, store, it);
        broadcast({ type: 'sync:failed', store, id: it.id, error: String(e) });
      } else {
        it.status = 'queued';
        it.retryCount = retry;
        it.nextAttemptAt = now + computeBackoffMs(retry);
        await idbUpdate(db, store, it);
        broadcast({
          type: 'sync:rescheduled',
          store,
          id: it.id,
          retryCount: retry,
        });
      }
    }
  }
}

function broadcast(msg) {
  try {
    const bc = new BroadcastChannel('sync-status');
    bc.postMessage(msg);
    bc.close();
  } catch {
    // ignore
  }
}

async function runSyncAll() {
  const db = await idbOpen();
  const now = Date.now();
  // Sender stubs – replace with real endpoints in production
  const sendForm = async (it) => {
    const resp = await fetch('/api/offline/forms', {
      method: 'POST',
      body: JSON.stringify(it.payload || {}),
      headers: { 'Content-Type': 'application/json' },
    });
    try {
      const json = await resp.json();
      if (json && json.type === 'task' && json.data && json.data.id) {
        // Conflict resolution (server wins on newer updatedAt)
        const db = await idbOpen();
        const tx = db.transaction('tasks', 'readwrite');
        const store = tx.objectStore('tasks');
        const getReq = store.get(json.data.id);
        await new Promise((res, rej) => {
          getReq.onsuccess = res;
          getReq.onerror = rej;
        });
        const local = getReq.result || null;
        const server = json.data;
        const localTs =
          local && local.modifiedAt ? new Date(local.modifiedAt).getTime() : 0;
        const serverTs =
          server && server.updatedAt ? new Date(server.updatedAt).getTime() : 0;
        let merged = server;
        if (localTs > serverTs) {
          merged = local;
        } else if (serverTs > localTs) {
          // notify ribbon
          broadcast({
            type: 'conflict:server-wins',
            id: server.id,
            updatedBy: server.updatedBy || null,
            updatedAt: server.updatedAt || null,
          });
        }
        const putReq = store.put(merged);
        await new Promise((res, rej) => {
          putReq.onsuccess = res;
          putReq.onerror = rej;
        });
        db.close();
      }
    } catch {
      // ignore JSON parse or IDB issues
    }
  };
  const sendBlob = async (it) => {
    // Example upload placeholder; adjust per real endpoint
    const formData = new FormData();
    formData.append(
      'file',
      it.blob || new Blob([]),
      (it.metadata && it.metadata.name) || 'upload.bin'
    );
    await fetch('/api/offline/upload', { method: 'POST', body: formData });
  };
  await processStore(db, 'forms', sendForm, now);
  await processStore(db, 'images', sendBlob, now);
  await processStore(db, 'signatures', sendBlob, now);
  db.close();
}

self.addEventListener('sync', (event) => {
  if (!event.tag) return;
  if (event.tag.startsWith('sync-')) {
    event.waitUntil(runSyncAll());
  }
});

self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data) return;
  if (data.type === 'manual-sync') {
    event.waitUntil(runSyncAll());
  }
});

self.addEventListener('online', () => {
  runSyncAll(); // best-effort fallback
});

/* global self, clients */
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
    (notification.data && (notification.data.url || notification.data.route)) ||
    '/';

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
