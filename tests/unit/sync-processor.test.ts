import { processQueue, QueueAdapter, QueueItem } from '@/lib/syncProcessor';

function makeAdapter(initial: QueueItem[]): QueueAdapter & { data: QueueItem[] } {
  const data = initial;
  return {
    data,
    async getAll() {
      return data.slice();
    },
    async update(id, patch) {
      const idx = data.findIndex((x) => x.id === id);
      if (idx === -1) return false;
      data[idx] = { ...data[idx], ...patch };
      return true;
    },
    async remove(id) {
      const idx = data.findIndex((x) => x.id === id);
      if (idx === -1) return false;
      data.splice(idx, 1);
      return true;
    },
  };
}

describe('syncProcessor', () => {
  it('marks success and removes item', async () => {
    const adapter = makeAdapter([{ id: 1, status: 'queued', createdAt: Date.now() }]);
    const send = jest.fn().mockResolvedValue(undefined);
    const res = await processQueue(adapter, send, { now: Date.now() });
    expect(res.succeeded).toBe(1);
    expect(adapter.data.find((x) => x.id === 1)).toBeUndefined();
  });

  it('applies backoff and increments retryCount on failure then succeeds', async () => {
    const now = Date.now();
    const adapter = makeAdapter([{ id: 2, status: 'queued', createdAt: now }]);
    const send = jest
      .fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce(undefined);
    const r1 = await processQueue(adapter, send, { now, baseDelayMs: 100, jitterMs: 0 });
    expect(r1.processed).toBe(1);
    const item = adapter.data.find((x) => x.id === 2)!;
    expect(item.retryCount).toBe(1);
    expect(item.nextAttemptAt! >= now + 100).toBe(true);
    // second attempt after backoff time
    const r2 = await processQueue(adapter, send, { now: item.nextAttemptAt! + 1, baseDelayMs: 100, jitterMs: 0 });
    expect(r2.succeeded).toBe(1);
    expect(adapter.data.find((x) => x.id === 2)).toBeUndefined();
  });

  it('marks failed when exceeding maxRetries', async () => {
    const now = Date.now();
    const adapter = makeAdapter([{ id: 3, status: 'queued', createdAt: now }]);
    const send = jest.fn().mockRejectedValue(new Error('always'));
    let currentNow = now;
    // run enough cycles to exceed 2 retries
    for (let i = 0; i < 4; i++) {
      await processQueue(adapter, send, { now: currentNow, baseDelayMs: 1, jitterMs: 0, maxRetries: 2 });
      const it = adapter.data[0];
      currentNow = (it.nextAttemptAt ?? currentNow) + 1;
    }
    const it = adapter.data[0];
    expect(it.status).toBe('failed');
    expect((it.retryCount ?? 0) > 2).toBe(true);
  });
});


