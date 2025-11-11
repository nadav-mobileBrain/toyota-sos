import { getVapidPublicKey, isBase64Url, urlBase64ToUint8Array, getVapidApplicationServerKey } from '@/lib/push';

describe('push utils (VAPID)', () => {
  const OLD_ENV = process.env;
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV };
  });
  afterAll(() => {
    process.env = OLD_ENV;
  });

  test('isBase64Url validates url-safe base64 strings', () => {
    expect(isBase64Url('')).toBe(false);
    expect(isBase64Url('abc$')).toBe(false);
    expect(isBase64Url('AbC_-012')).toBe(true);
    expect(isBase64Url('AbC_-012=')).toBe(true);
    expect(isBase64Url('AbC_-012==')).toBe(true);
  });

  test('urlBase64ToUint8Array converts properly', () => {
    // "test" -> base64url "dGVzdA"
    const arr = urlBase64ToUint8Array('dGVzdA');
    expect(arr).toBeInstanceOf(Uint8Array);
    expect(arr.length).toBeGreaterThan(0);
  });

  test('getVapidPublicKey returns env var', () => {
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = 'AbC_-012';
    expect(getVapidPublicKey()).toBe('AbC_-012');
  });

  test('getVapidApplicationServerKey throws on missing/invalid', () => {
    delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    expect(() => getVapidApplicationServerKey()).toThrow(/Missing/);
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = 'not+url+safe';
    expect(() => getVapidApplicationServerKey()).toThrow(/Invalid/);
  });

  test('getVapidApplicationServerKey returns Uint8Array when valid', () => {
    // "test" base64url without padding
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = 'dGVzdA';
    const key = getVapidApplicationServerKey();
    expect(key).toBeInstanceOf(Uint8Array);
    expect(key.length).toBeGreaterThan(0);
  });
});


