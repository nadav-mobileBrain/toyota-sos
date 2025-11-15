import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DriverHome, __internal } from '@/components/driver/DriverHome';

jest.mock('next/navigation', () => {
  return {
    usePathname: () => '/driver',
    useRouter: () => ({ replace: jest.fn() }),
    useSearchParams: () => new URLSearchParams(''),
  };
});

// Mock Supabase client via AuthProvider + driver session helper
const rpcMock = jest.fn();
const getDriverSessionMock = jest.fn();

jest.mock('@/components/AuthProvider', () => {
  return {
    useAuth: () => ({
      client: {
        rpc: rpcMock,
      },
    }),
  };
});

jest.mock('@/lib/auth', () => {
  return {
    getDriverSession: getDriverSessionMock,
  };
});

describe('DriverHome filtering and tabs', () => {
  const now = Date.now();
  const todayItems = [
    {
      id: 't1',
      title: 'מסירת רכב ללקוח',
      type: 'pickup_or_dropoff_car',
      priority: 'high' as const,
      status: 'pending' as const,
      estimated_start: new Date(now - 60 * 60 * 1000).toISOString(),
      estimated_end: new Date(now + 30 * 60 * 1000).toISOString(),
      updated_at: new Date(now + 10 * 1000).toISOString(),
    },
    {
      id: 't2',
      title: 'הסעת לקוח למוסך',
      type: 'drive_client_to_dealership',
      priority: 'medium' as const,
      status: 'in_progress' as const,
      estimated_start: new Date(now - 30 * 60 * 1000).toISOString(),
      estimated_end: new Date(now + 60 * 60 * 1000).toISOString(),
      updated_at: new Date(now + 5 * 1000).toISOString(),
    },
  ];
  const overdueItems = [
    {
      id: 't3',
      title: 'מסירת רכב חלופי',
      type: 'replacement_car_delivery',
      priority: 'low' as const,
      status: 'pending' as const,
      estimated_start: new Date(now - 5 * 60 * 60 * 1000).toISOString(),
      estimated_end: new Date(now - 3 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(now + 1 * 1000).toISOString(),
    },
  ];

  beforeEach(() => {
    rpcMock.mockReset();
    getDriverSessionMock.mockReturnValue({
      employeeId: '22222',
      userId: 'driver-profile-id-22222',
      role: 'driver',
      createdAt: Date.now(),
    });
    // default RPC returns "today" dataset
    rpcMock.mockResolvedValue({ data: todayItems, error: null });
  });

  test('default tab today shows only tasks intersecting today', async () => {
    render(<DriverHome tasks={[]} />);
    // There are 3 today-intersecting tasks by the provided dates (all within today).
    // But overdue is also today intersecting; we assert count >= 2 and contains titles.
    expect(await screen.findByText('מסירת רכב ללקוח')).toBeInTheDocument();
    expect(await screen.findByText('הסעת לקוח למוסך')).toBeInTheDocument();
  });

  test('switch to Overdue tab shows only overdue item', async () => {
    // Set call order: initial -> overdue
    rpcMock.mockResolvedValueOnce({ data: todayItems, error: null }); // initial mount
    rpcMock.mockResolvedValueOnce({ data: overdueItems, error: null }); // after tab change
    render(<DriverHome tasks={[]} />);
    await userEvent.click(screen.getByRole('button', { name: 'איחורים' }));
    expect(await screen.findByText('מסירת רכב חלופי')).toBeInTheDocument();
    // And hide a non-overdue one
    expect(screen.queryByText('הסעת לקוח למוסך')).not.toBeInTheDocument();
  });

  test('switch to All tab shows all items', async () => {
    rpcMock.mockResolvedValueOnce({ data: todayItems, error: null }); // initial mount
    // For 'all', just return union here (simplified for test)
    rpcMock.mockResolvedValueOnce({ data: [...todayItems, ...overdueItems], error: null });
    render(<DriverHome tasks={[]} />);
    await userEvent.click(screen.getByRole('button', { name: 'הכל' }));
    expect(await screen.findByText('מסירת רכב ללקוח')).toBeInTheDocument();
    expect(await screen.findByText('הסעת לקוח למוסך')).toBeInTheDocument();
    expect(await screen.findByText('מסירת רכב חלופי')).toBeInTheDocument();
  });
});

describe('pagination de-duplication', () => {
  const now = Date.now();
  const page1 = Array.from({ length: 10 }).map((_, i) => ({
    id: `p1-${i}`,
    title: `p1-${i}`,
    type: 'pickup_or_dropoff_car',
    priority: 'low' as const,
    status: 'pending' as const,
    estimated_start: new Date(now - (i + 1) * 1000).toISOString(),
    estimated_end: new Date(now + (i + 1) * 1000).toISOString(),
    updated_at: new Date(now - (i + 1) * 1000).toISOString(),
  }));
  // Second page overlaps with last of first page
  const page2 = [
    page1[2],
    {
      id: 'p2-new',
      title: 'p2-new',
      type: 'drive_client_to_dealership',
      priority: 'medium' as const,
      status: 'in_progress' as const,
      estimated_start: new Date(now - 10 * 1000).toISOString(),
      estimated_end: new Date(now + 10 * 1000).toISOString(),
      updated_at: new Date(now - 10 * 1000).toISOString(),
    },
  ];

  beforeEach(() => {
    rpcMock.mockReset();
    getDriverSessionMock.mockReturnValue({
      employeeId: '22222',
      userId: 'driver-profile-id-22222',
      role: 'driver',
      createdAt: Date.now(),
    });
    rpcMock.mockResolvedValue({ data: page1, error: null });
  });

  test('appending next page does not duplicate overlapping items', async () => {
    rpcMock.mockResolvedValueOnce({ data: page1, error: null }); // initial
    rpcMock.mockResolvedValueOnce({ data: page2, error: null }); // load more
    render(<DriverHome tasks={[]} />);
    // initial render (one of the items)
    expect(await screen.findByText('p1-0')).toBeInTheDocument();
    // click Load more
    await userEvent.click(screen.getByRole('button', { name: 'טען עוד' }));
    // still only 4 unique titles
    expect(screen.getByText('p1-0')).toBeInTheDocument();
    expect(screen.getByText('p1-1')).toBeInTheDocument();
    expect(screen.getByText('p1-2')).toBeInTheDocument();
    expect(screen.getByText('p2-new')).toBeInTheDocument();
  });
});

describe('pull-to-refresh', () => {
  const now = Date.now();
  const initialItems = [
    {
      id: 'a1',
      title: 'initial-1',
      type: 'pickup_or_dropoff_car',
      priority: 'low' as const,
      status: 'pending' as const,
      estimated_start: new Date(now - 1000).toISOString(),
      estimated_end: new Date(now + 1000).toISOString(),
      updated_at: new Date(now - 1000).toISOString(),
    },
  ];
  const refreshedItems = [
    {
      id: 'r1',
      title: 'refreshed-1',
      type: 'drive_client_to_dealership',
      priority: 'medium' as const,
      status: 'in_progress' as const,
      estimated_start: new Date(now - 2000).toISOString(),
      estimated_end: new Date(now + 2000).toISOString(),
      updated_at: new Date(now - 2000).toISOString(),
    },
  ];

  beforeEach(() => {
    rpcMock.mockReset();
    getDriverSessionMock.mockReturnValue({
      employeeId: '22222',
      userId: 'driver-profile-id-22222',
      role: 'driver',
      createdAt: Date.now(),
    });
  });

  test('dragging down past threshold triggers a refresh RPC', async () => {
    // First call: initial load
    rpcMock.mockResolvedValueOnce({ data: initialItems, error: null });
    // Second call: refresh load
    rpcMock.mockResolvedValueOnce({ data: refreshedItems, error: null });

    const { container } = render(<DriverHome tasks={[]} />);
    // wait initial
    expect(await screen.findByText('initial-1')).toBeInTheDocument();

    const root = container.querySelector('div.space-y-4') as HTMLElement;
    expect(root).toBeTruthy();

    // Start pull gesture at top (scrollTop assumed 0 in jsdom)
    fireEvent.pointerDown(root, { clientY: 10 });
    // Move sufficiently to exceed threshold (64px threshold; dampening 0.6)
    // 150 - 10 = 140 -> dampened 84 > 64
    fireEvent.pointerMove(root, { clientY: 150 });
    // Wait for indicator to appear (ensures state flush)
    expect(
      await screen.findByText((text) => text === 'משוך לרענון' || text === 'שחרר לרענון')
    ).toBeInTheDocument();
    fireEvent.pointerUp(root);

    // Expect a refresh call (second RPC)
    await waitFor(() => expect(rpcMock).toHaveBeenCalledTimes(2));
    // And new item rendered
    expect(await screen.findByText('refreshed-1')).toBeInTheDocument();
  });
});

describe('date helpers', () => {
  const { intersectsToday, isOverdue } = __internal;

  test('isOverdue true when end < now and not completed', () => {
    expect(
      isOverdue({
        id: 'x',
        title: 't',
        type: 'x',
        priority: 'low',
        status: 'pending',
        estimatedEnd: new Date(Date.now() - 1000),
      } as any)
    ).toBe(true);
  });

  test('isOverdue false when status=completed', () => {
    expect(
      isOverdue({
        id: 'x',
        title: 't',
        type: 'x',
        priority: 'low',
        status: 'completed',
        estimatedEnd: new Date(Date.now() - 1000),
      } as any)
    ).toBe(false);
  });

  test('intersectsToday true when range overlaps current day', () => {
    const s = new Date();
    const e = new Date(Date.now() + 60 * 60 * 1000);
    expect(intersectsToday(s, e)).toBe(true);
  });
});


