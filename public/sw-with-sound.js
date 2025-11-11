// Service Worker with sound & vibration support (Task 6.7)
// Plays sound and vibration on notifications if user gesture was previously captured

let soundAllowed = false;

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const options = {
      title: data.title || 'Toyota SOS',
      body: data.body || '',
      icon: '/toyota-icon.png',
      badge: '/toyota-badge.png',
      tag: data.tag || 'default',
      data: data.data || {},
      vibrate: [200, 100, 200],
      requireInteraction: false,
      dir: 'rtl',
      renotify: true,
      actions: data.actions || [
        { action: 'open', title: 'פתח' },
        { action: 'close', title: 'סגור' },
      ],
    };

    // Vibration on modern Android
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate([200, 100, 200]);
      } catch {
        // ignore if not supported
      }
    }

    // Sound: only if browser supports AudioContext and user previously allowed it
    // (detect via localStorage set during app initialization)
    if (soundAllowed && typeof AudioContext !== 'undefined') {
      playNotificationSound();
    }

    event.waitUntil(self.registration.showNotification(options.title, options));
  } catch (e) {
    console.error('Push event error:', e);
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const action = event.action;
  const dataUrl = event.notification.data?.url || '/';

  if (action === 'close') {
    return;
  }

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Focus existing client if already open
        for (const client of clientList) {
          if (client.url === dataUrl && 'focus' in client) {
            return client.focus();
          }
        }
        // Open new window if not found
        if (clients.openWindow) {
          return clients.openWindow(dataUrl);
        }
      })
  );
});

// Utility: play a short beep sound (requires user gesture in main app first)
function playNotificationSound() {
  try {
    const ctx = new (self.AudioContext || self.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.frequency.value = 800;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
  } catch {
    // ignore: AudioContext may not be available in all environments
  }
}

// Listen for message from main thread to enable sound
self.addEventListener('message', (event) => {
  if (event.data?.type === 'ENABLE_NOTIFICATION_SOUND') {
    soundAllowed = true;
  }
});

