import { notify } from '@/lib/notify';
import webpush from 'web-push';

// Mock web-push library
jest.mock('web-push', () => ({
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn().mockResolvedValue({}),
}));

// Mock Supabase
jest.mock('@/lib/supabaseAdmin', () => {
  return {
    getSupabaseAdmin: () => ({
      from: (table: string) => {
        if (table === 'push_subscriptions') {
          return {
            select: () => ({
              in: () => ({ data: [] }), // Mock empty subscriptions from DB
            }),
          };
        }
        if (table === 'notifications') {
          return {
            insert: async (_rows: any[]) => ({ error: null }),
          };
        }
        return {
          select: () => ({ in: () => ({ data: [] }) }),
          insert: async () => ({ error: null }),
        };
      },
    }),
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
      task_date: new Date(), // Today - should send push
      payload: { title: 'עודכן', body: 'משימה עודכנה' },
      recipients: [
        {
          user_id: '11111111-1111-1111-1111-111111111111',
          subscription: {
            endpoint: 'https://example.com/push/abc',
            keys: { p256dh: 'k', auth: 'a' },
          },
        },
      ],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.inserted).toBe(1);
    }

    // Check if webpush.sendNotification was called
    expect(webpush.sendNotification).toHaveBeenCalledTimes(1);
  });

  test('rejects invalid request', async () => {
    const result = await notify({} as any);
    expect(result.ok).toBe(false);
  });
});
