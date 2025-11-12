'use client';

/**
 * Client helpers for scheduling background sync and manual triggers.
 */
export async function scheduleSync(tag: 'forms' | 'images' | 'signatures' | 'all' = 'all') {
  try {
    if (!('serviceWorker' in navigator)) return;
    const reg = await navigator.serviceWorker.ready;
    if ('sync' in reg) {
      const t = tag === 'all' ? 'sync-all' : `sync-${tag}`;
      await (reg as any).sync.register(t);
    } else {
      // Fallback: ask SW to run immediately (will no-op offline and retry on next online)
      reg.active?.postMessage({ type: 'manual-sync' });
    }
  } catch {
    // ignore
  }
}

export function triggerManualSync() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.ready.then((reg) => {
    reg.active?.postMessage({ type: 'manual-sync' });
  });
}


