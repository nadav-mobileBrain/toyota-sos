import { notify } from '@/app/api/functions/notify/handler';

jest.mock('@/lib/supabaseAdmin', () => {
  return {
    getSupabaseAdmin: () => ({
      from: () => ({
        insert: async (_rows: any[]) => ({ error: null }),
      }),
    }),
  };
});

const sendWebPushMock = jest.fn();
jest.mock('@/lib/notify', () => {
  return {
    sendWebPush: (...args: any[]) => sendWebPushMock(...args),
  };
});

describe('POST /api/functions/notify (6.4)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('routes push and inserts in-app notifications', async () => {
    const result = await notify({
      type: 'task_updated',
      task_id: '00000000-0000-0000-0000-000000000001',
      payload: { title: 'עודכן', body: 'משימה עודכנה' },
      recipients: [
        {
          user_id: '11111111-1111-1111-1111-111111111111',
          subscription: { endpoint: 'https://example.com/push/abc', keys: { p256dh: 'k', auth: 'a' } },
        },
      ],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.inserted).toBe(1);
    }
    expect(sendWebPushMock).toHaveBeenCalledTimes(1);
  });

  test('rejects invalid request', async () => {
    const result = await notify({} as any);
    expect(result.ok).toBe(false);
  });
});


