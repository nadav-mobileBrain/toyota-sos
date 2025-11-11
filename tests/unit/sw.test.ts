/* eslint-disable @typescript-eslint/no-explicit-any */
describe('Service Worker push and notification click (6.2)', () => {
  const listeners: Record<string, Function> = {};
  const showNotification = jest.fn();
  const openWindow = jest.fn();
  const focus = jest.fn();
  const navigate = jest.fn();

  beforeEach(() => {
    jest.resetModules();
    Object.keys(listeners).forEach((k) => delete listeners[k]);
    showNotification.mockReset();
    openWindow.mockReset();
    focus.mockReset();
    navigate.mockReset();

    (global as any).self = {
      addEventListener: (type: string, cb: Function) => {
        listeners[type] = cb;
      },
      skipWaiting: jest.fn(),
      clients: {
        claim: jest.fn(),
      },
      registration: {
        showNotification,
      },
    };
    (global as any).clients = {
      matchAll: jest.fn().mockResolvedValue([]),
      openWindow,
    };

    // Import SW after mocking self/clients so it registers listeners
    require('@/public/sw.js');
  });

  test('shows notification with RTL and payload data', async () => {
    const payload = {
      title: 'בדיקה',
      body: 'תוכן',
      tag: 't-1',
      data: { url: '/driver/tasks/1' },
    };
    const evt: any = {
      data: { json: () => payload },
      waitUntil: (p: Promise<any>) => p,
    };
    await listeners['push'](evt);
    expect(showNotification).toHaveBeenCalledTimes(1);
    const [title, options] = showNotification.mock.calls[0];
    expect(title).toBe('בדיקה');
    expect(options.body).toBe('תוכן');
    expect(options.tag).toBe('t-1');
    expect(options.data.url).toBe('/driver/tasks/1');
    expect(options.dir).toBe('rtl');
    expect(options.lang).toBe('he-IL');
  });

  test('notificationclick focuses existing client and navigates', async () => {
    (global as any).clients.matchAll.mockResolvedValue([{ focus, navigate }]);
    let pending: Promise<any> | null = null;
    const evt: any = {
      notification: {
        close: jest.fn(),
        data: { url: '/driver/tasks/2' },
      },
      action: '',
      waitUntil: (p: Promise<any>) => {
        pending = p;
      },
    };
    await listeners['notificationclick'](evt);
    if (pending) await pending;
    expect(focus).toHaveBeenCalled();
    // Either navigate is available or SW may fallback to openWindow
    if (navigate.mock.calls.length > 0) {
      expect(navigate).toHaveBeenCalledWith('/driver/tasks/2');
      expect(openWindow).not.toHaveBeenCalled();
    } else {
      expect(openWindow).toHaveBeenCalledWith('/driver/tasks/2');
    }
  });

  test('notificationclick opens window when no clients', async () => {
    (global as any).clients.matchAll.mockResolvedValue([]);
    let pending: Promise<any> | null = null;
    const evt: any = {
      notification: {
        close: jest.fn(),
        data: { url: '/driver/tasks/3' },
      },
      action: '',
      waitUntil: (p: Promise<any>) => {
        pending = p;
      },
    };
    await listeners['notificationclick'](evt);
    if (pending) await pending;
    expect(openWindow).toHaveBeenCalledWith('/driver/tasks/3');
  });
});


