import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NotificationsList } from '@/components/notifications/NotificationsList';

// Mock router
const pushMock = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

// Mock Supabase browser client
const selectMock = jest.fn();
const orderMock = jest.fn();
const rangeMock = jest.fn();
const notMock = jest.fn();
const updateMock = jest.fn();
const inMock = jest.fn();
const upsertMock = jest.fn();
const fromMock = jest.fn();

jest.mock('@/lib/auth', () => {
  return {
    createBrowserClient: () => ({
      from: (table: string) => {
        fromMock(table);
        return {
          select: (...args: any[]) => {
            selectMock(...args);
            return { not: notMock, order: orderMock, range: rangeMock };
          },
          update: (...args: any[]) => {
            updateMock(...args);
            return { eq: () => ({ error: null }), in: inMock };
          },
          upsert: (...args: any[]) => {
            upsertMock(...args);
            return { error: null };
          },
        };
      },
    }),
  };
});

describe('NotificationsList (5)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    inMock.mockReturnValue({ error: null });
    // Chainable mocks for list fetch
    const data = [
      {
        id: 'n1',
        user_id: 'u1',
        type: 'task_assigned',
        task_id: 't1',
        payload: {},
        read: false,
        created_at: new Date().toISOString(),
      },
      {
        id: 'n2',
        user_id: 'u1',
        type: 'task_completed',
        task_id: 't2',
        payload: {},
        read: true,
        created_at: new Date(Date.now() - 1000).toISOString(),
      },
    ];
    rangeMock.mockResolvedValueOnce({ data, error: null });
    orderMock.mockReturnValueOnce({ range: rangeMock });
    notMock.mockReturnValueOnce({ order: orderMock });
  });

  test('renders groups and supports mark-as-read and delete', async () => {
    render(<NotificationsList pageSize={10} />);
    expect(await screen.findByText('חדשים')).toBeInTheDocument();
    expect(screen.getByText('נקראו')).toBeInTheDocument();

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]); // select n1
    const markReadBtn = screen.getByRole('button', { name: 'סמן כנקראו' });
    fireEvent.click(markReadBtn);
    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledWith({ read: true });
    });

    const deleteBtn = screen.getAllByRole('button', { name: 'מחק' })[0];
    fireEvent.click(deleteBtn);
    await waitFor(() => {
      expect(upsertMock).toHaveBeenCalled();
    });
  });

  test('deep links to task when clicking item', async () => {
    render(<NotificationsList pageSize={10} />);
    const openButtons = await screen.findAllByRole('button', { name: 'פתח' });
    fireEvent.click(openButtons[0]);
    expect(pushMock).toHaveBeenCalledWith('/driver/tasks/t1');
  });
});


