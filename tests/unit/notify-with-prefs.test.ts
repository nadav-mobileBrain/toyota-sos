import { notifyWithPreferences } from '@/app/api/functions/notify/handler-with-prefs';

jest.mock('@/lib/supabaseAdmin', () => ({
  getSupabaseAdmin: () => ({
    from: (table: string) => ({
      select: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({
        data: [
          { user_id: 'user1', event_type: 'assigned', enabled: true },
          { user_id: 'user2', event_type: 'assigned', enabled: false },
        ],
        error: null,
      }),
      insert: jest.fn().mockResolvedValue({ error: null }),
    }),
  }),
}));

jest.mock('@/lib/notify', () => ({
  sendWebPush: jest.fn().mockResolvedValue(undefined),
}));

describe('Notify with Preferences (6.7)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('filters recipients based on preferences', async () => {
    const result = await notifyWithPreferences({
      type: 'assigned',
      task_id: 'task1',
      payload: { title: 'הוקצה', body: 'משימה חדשה' },
      recipients: [
        { user_id: 'user1', subscription: { endpoint: 'https://example.com/push/1' } },
        { user_id: 'user2', subscription: { endpoint: 'https://example.com/push/2' } },
      ],
    });

    // user1 has enabled:true, user2 has enabled:false
    // So result should show 1 inserted, 1 filtered
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.inserted).toBe(1); // only user1
      expect(result.filtered).toBe(1); // user2 excluded
    }
  });

  test('returns error on invalid request', async () => {
    const result = await notifyWithPreferences({} as any);
    expect(result.ok).toBe(false);
  });

  test('returns defaults to enabled if no preference found', async () => {
    // Mock no preferences returned
    const admin = require('@/lib/supabaseAdmin').getSupabaseAdmin();
    admin.from('notification_preferences').select().in().eq = jest.fn().mockResolvedValue({
      data: [], // empty: no preferences
      error: null,
    });

    const result = await notifyWithPreferences({
      type: 'updated',
      payload: { title: 'עודכן' },
      recipients: [
        { user_id: 'user3', subscription: { endpoint: 'https://example.com/push/3' } },
      ],
    });

    // With no preference, default is enabled: true
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.inserted).toBe(1);
      expect(result.filtered).toBe(0);
    }
  });
});

