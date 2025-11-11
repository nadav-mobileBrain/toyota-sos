import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { NotificationsBadge } from '@/components/notifications/Badge';

// Mocks for Supabase client
const selectMock = jest.fn();
const headSelectReturn = { eq: jest.fn().mockReturnThis(), not: jest.fn().mockResolvedValue({ count: 5 }) };
selectMock.mockReturnValue(headSelectReturn);

const channelHandlers: any[] = [];
const subscribeMock = jest.fn().mockReturnValue({}); // noop subscription object
const onMock = jest.fn().mockImplementation((_event, _filter, cb) => {
  channelHandlers.push(cb);
  return { subscribe: subscribeMock };
});
const channelMock = jest.fn().mockReturnValue({ on: onMock, subscribe: subscribeMock });
const removeChannelMock = jest.fn();

jest.mock('@/lib/auth', () => ({
  createBrowserClient: () => ({
    from: () => ({
      select: (columns: string, _opts: any) => {
        // Expect "*", { count: 'exact', head: true }
        return selectMock(columns);
      },
    }),
    channel: channelMock,
    removeChannel: removeChannelMock,
  }),
}));

describe('NotificationsBadge (6)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    channelHandlers.length = 0;
  });

  test('initially fetches unread count and renders it', async () => {
    render(<NotificationsBadge />);
    const el = await screen.findByTestId('unread-notifications-count');
    expect(el).toHaveTextContent('5');
  });

  test('increments on INSERT with read=false', async () => {
    render(<NotificationsBadge refreshOnEvents={false} />);
    const el = await screen.findByTestId('unread-notifications-count');
    expect(el).toHaveTextContent('5');
    // Simulate realtime event
    await act(async () => {
      channelHandlers.forEach((cb) =>
        cb({
          eventType: 'INSERT',
          new: { read: false, payload: {} },
          schema: 'public',
          table: 'notifications',
        })
      );
    });
    expect(el).toHaveTextContent('6');
  });

  test('decrements on UPDATE when read flips to true', async () => {
    render(<NotificationsBadge refreshOnEvents={false} />);
    const el = await screen.findByTestId('unread-notifications-count');
    expect(el).toHaveTextContent('5');
    await act(async () => {
      channelHandlers.forEach((cb) =>
        cb({
          eventType: 'UPDATE',
          old: { read: false, payload: {} },
          new: { read: true, payload: {} },
          schema: 'public',
          table: 'notifications',
        })
      );
    });
    expect(el).toHaveTextContent('4');
  });
});


