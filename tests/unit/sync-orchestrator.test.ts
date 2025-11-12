import { onSyncEvent, startSync, stopSync, scheduleSync, triggerManualSync } from '@/lib/sync';

// Mock BroadcastChannel
class FakeBC {
  static last: FakeBC | null = null;
  public onmessage: ((ev: any) => void) | null = null;
  constructor(public name: string) {
    FakeBC.last = this;
  }
  post(msg: any) {
    this.onmessage && this.onmessage({ data: msg });
  }
  close() {}
}

describe('sync orchestrator', () => {
  beforeEach(() => {
    // @ts-ignore
    global.BroadcastChannel = FakeBC as any;
    // Mock serviceWorker.ready
    (global as any).navigator = {
      serviceWorker: {
        ready: Promise.resolve({
          sync: { register: jest.fn(async () => {}) },
          active: { postMessage: jest.fn() },
        }),
      },
    };
  });

  afterEach(() => {
    stopSync();
    // @ts-ignore
    delete (global as any).BroadcastChannel;
    // @ts-ignore
    delete (global as any).navigator;
  });

  it('subscribes to sync events and receives broadcast messages', async () => {
    const messages: any[] = [];
    const unsub = onSyncEvent((e) => messages.push(e));
    await startSync();
    // simulate SW message
    (FakeBC.last as any).post({ type: 'sync:success', store: 'forms', id: 1 });
    expect(messages[0]).toEqual({ type: 'sync:success', store: 'forms', id: 1 });
    unsub();
  });

  it('triggers background sync registration and manual postMessage', async () => {
    const ready = await (navigator as any).serviceWorker.ready;
    const registerSpy = jest.spyOn(ready.sync, 'register');
    const postSpy = jest.spyOn(ready.active, 'postMessage');
    await scheduleSync('all');
    expect(registerSpy).toHaveBeenCalled();
    triggerManualSync();
    // wait microtask
    await new Promise((r) => setTimeout(r, 0));
    expect(postSpy).toHaveBeenCalledWith({ type: 'manual-sync' });
  });
});


