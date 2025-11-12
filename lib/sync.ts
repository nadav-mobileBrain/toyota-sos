'use client';

/**
 * Client helpers for scheduling background sync and manual triggers,
 * plus a light orchestrator and event subscriptions.
 */

export type QueueType = 'forms' | 'images' | 'signatures';
export type SyncEvent =
  | { type: 'sync:success'; store: QueueType; id: number }
  | { type: 'sync:failed'; store: QueueType; id: number; error?: string }
  | { type: 'sync:rescheduled'; store: QueueType; id: number; retryCount: number }
  | { type: 'conflict:server-wins'; id: string; updatedBy?: string | null; updatedAt?: string | number | Date | null };

const CHANNEL = 'sync-status';
let bc: BroadcastChannel | null = null;
const listeners = new Set<(e: SyncEvent) => void>();
let registeredOrder: QueueType[] = ['forms', 'images', 'signatures'];

export async function scheduleSync(tag: QueueType | 'all' = 'all') {
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

export function onSyncEvent(cb: (e: SyncEvent) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  if (!('BroadcastChannel' in window)) return () => {};
  if (!bc) {
    bc = new BroadcastChannel(CHANNEL);
    bc.onmessage = (ev: MessageEvent) => {
      const data = ev.data;
      if (!data || !data.type) return;
      listeners.forEach((l) => {
        try {
          l(data);
        } catch {
          // ignore
        }
      });
    };
  }
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0 && bc) {
      try {
        bc.close();
      } catch {}
      bc = null;
    }
  };
}

export function registerQueue(order: QueueType[]) {
  registeredOrder = order.slice();
}

export async function startSync(order?: QueueType[]) {
  if (order && order.length) registerQueue(order);
  // Use background sync if available, otherwise manual message
  await scheduleSync('all');
  triggerManualSync();
}

export function stopSync() {
  // No continuous polling to stop; close event channel listeners if any
  if (bc) {
    try {
      bc.close();
    } catch {}
    bc = null;
  }
  listeners.clear();
}


