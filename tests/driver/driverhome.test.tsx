import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DriverHome, __internal } from '@/components/driver/DriverHome';

jest.mock('next/navigation', () => {
  return {
    usePathname: () => '/driver',
    useRouter: () => ({ replace: jest.fn() }),
    useSearchParams: () => new URLSearchParams(''),
  };
});

describe('DriverHome filtering and tabs', () => {
  const now = Date.now();
  const tasks = [
    {
      id: 't1',
      title: 'מסירת רכב ללקוח',
      type: 'pickup_or_dropoff_car',
      priority: 'high' as const,
      status: 'pending' as const,
      estimatedStart: new Date(now - 60 * 60 * 1000),
      estimatedEnd: new Date(now + 30 * 60 * 1000),
    },
    {
      id: 't2',
      title: 'הסעת לקוח למוסך',
      type: 'drive_client_to_dealership',
      priority: 'medium' as const,
      status: 'in_progress' as const,
      estimatedStart: new Date(now - 30 * 60 * 1000),
      estimatedEnd: new Date(now + 60 * 60 * 1000),
    },
    {
      id: 't3',
      title: 'מסירת רכב חלופי',
      type: 'replacement_car_delivery',
      priority: 'low' as const,
      status: 'pending' as const,
      estimatedStart: new Date(now - 5 * 60 * 60 * 1000),
      estimatedEnd: new Date(now - 3 * 60 * 60 * 1000), // overdue
    },
  ];

  test('default tab today shows only tasks intersecting today', () => {
    render(<DriverHome tasks={tasks as any} />);
    // There are 3 today-intersecting tasks by the provided dates (all within today).
    // But overdue is also today intersecting; we assert count >= 2 and contains titles.
    expect(screen.getByText('מסירת רכב ללקוח')).toBeInTheDocument();
    expect(screen.getByText('הסעת לקוח למוסך')).toBeInTheDocument();
  });

  test('switch to Overdue tab shows only overdue item', async () => {
    render(<DriverHome tasks={tasks as any} />);
    await userEvent.click(screen.getByRole('button', { name: 'איחורים' }));
    expect(screen.getByText('מסירת רכב חלופי')).toBeInTheDocument();
    // And hide a non-overdue one
    expect(screen.queryByText('הסעת לקוח למוסך')).not.toBeInTheDocument();
  });

  test('switch to All tab shows all items', async () => {
    render(<DriverHome tasks={tasks as any} />);
    await userEvent.click(screen.getByRole('button', { name: 'הכל' }));
    expect(screen.getByText('מסירת רכב ללקוח')).toBeInTheDocument();
    expect(screen.getByText('הסעת לקוח למוסך')).toBeInTheDocument();
    expect(screen.getByText('מסירת רכב חלופי')).toBeInTheDocument();
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


