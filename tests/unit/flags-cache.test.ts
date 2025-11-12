import { getFlags } from '../../lib/flags';

const realFetch = global.fetch;

describe('flags cache TTL', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ key: 'alpha', enabled: true }] }),
    });
  });
  afterEach(() => {
    jest.useRealTimers();
    (global as any).fetch = realFetch;
  });

  test('caches for 5 minutes then refetches', async () => {
    const first = await getFlags(true);
    expect(first.alpha).toBe(true);
    const fetchCallsAfterFirst = (global.fetch as any).mock.calls.length;

    // Immediate second call should not fetch again
    const second = await getFlags();
    expect(second.alpha).toBe(true);
    expect((global.fetch as any).mock.calls.length).toBe(fetchCallsAfterFirst);

    // Advance time 5m + 1ms to expire
    jest.advanceTimersByTime(5 * 60 * 1000 + 1);

    // Next call should fetch again
    await getFlags();
    expect((global.fetch as any).mock.calls.length).toBe(fetchCallsAfterFirst + 1);
  });
});


