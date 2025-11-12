/**
 * Framework-agnostic queue processor with exponential backoff.
 * Does not rely on window/DOM and can run in SW or Node tests.
 */

export type QueueItem = {
  id: number;
  payload?: any;
  blob?: Blob;
  metadata?: Record<string, any>;
  status?: 'queued' | 'sending' | 'failed' | 'done';
  retryCount?: number;
  nextAttemptAt?: number;
  createdAt?: number;
};

export type QueueAdapter = {
  getAll: () => Promise<QueueItem[]>;
  update: (id: number, patch: Partial<QueueItem>) => Promise<boolean>;
  remove: (id: number) => Promise<boolean>;
};

export type SendFn = (item: QueueItem) => Promise<void>;

export type ProcessOptions = {
  maxRetries?: number;
  baseDelayMs?: number;
  jitterMs?: number;
  now?: number;
};

function computeBackoffMs(retryCount: number, baseDelayMs: number, jitterMs: number): number {
  const pow = Math.pow(2, retryCount);
  const base = baseDelayMs * pow;
  const jitter = Math.floor(Math.random() * jitterMs);
  return base + jitter;
}

export async function processQueue(
  adapter: QueueAdapter,
  send: SendFn,
  opts: ProcessOptions = {}
): Promise<{ processed: number; succeeded: number; failed: number }> {
  const maxRetries = opts.maxRetries ?? 5;
  const baseDelayMs = opts.baseDelayMs ?? 1000;
  const jitterMs = opts.jitterMs ?? 500;
  const now = opts.now ?? Date.now();

  const items = await adapter.getAll();
  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  for (const item of items) {
    const nextAt = item.nextAttemptAt ?? 0;
    if (nextAt > now) continue; // not ready yet
    processed++;
    await adapter.update(item.id, { status: 'sending' });
    try {
      await send(item);
      await adapter.update(item.id, { status: 'done' });
      await adapter.remove(item.id);
      succeeded++;
    } catch {
      const retryCount = (item.retryCount ?? 0) + 1;
      if (retryCount > maxRetries) {
        await adapter.update(item.id, { status: 'failed', retryCount });
        failed++;
      } else {
        const delay = computeBackoffMs(retryCount, baseDelayMs, jitterMs);
        await adapter.update(item.id, {
          status: 'queued',
          retryCount,
          nextAttemptAt: now + delay,
        });
      }
    }
  }
  return { processed, succeeded, failed };
}


