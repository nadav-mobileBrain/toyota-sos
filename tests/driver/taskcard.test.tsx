import React from 'react';
import { render, screen } from '@testing-library/react';
import { TaskCard } from '@/components/driver/TaskCard';

describe('TaskCard', () => {
  const baseProps = {
    id: 't-1',
    title: 'מסירת רכב ללקוח',
    type: 'pickup_or_dropoff_car',
    priority: 'גבוהה' as const,
    status: 'בהמתנה' as const,
    estimatedStart: new Date('2025-01-01T10:00:00Z'),
    estimatedEnd: new Date('2025-01-01T12:30:00Z'),
    address: 'תל אביב, דיזנגוף 100',
    clientName: 'לקוח א',
    vehicle: { licensePlate: '12-345-67', model: 'Corolla' },
  };

  test('renders badges and title/type', () => {
    render(<TaskCard {...baseProps} />);
    expect(screen.getByText(baseProps.type)).toBeInTheDocument();

    // Priority badge present with expected class
    const priorityPill = screen.getByText('גבוהה');
    expect(priorityPill).toBeInTheDocument();
    expect(priorityPill.className).toMatch(/bg-red-600/);

    // Status toggle button present
    const statusButton = screen.getByText('בהמתנה');
    expect(statusButton).toBeInTheDocument();
  });

  test('formats time window (HH:mm – HH:mm)', () => {
    render(<TaskCard {...baseProps} />);
    const timeRow = screen.getByText(/חלון זמן:/);
    // Verify time-only format
    expect(timeRow.textContent).toMatch(
      /חלון זמן:\s*\d{2}:\d{2}\s–\s\d{2}:\d{2}/
    );
  });

  test('creates Waze deeplink with encoded address', () => {
    render(<TaskCard {...baseProps} />);
    const link = screen.getByRole('link', {
      name: 'Waze',
    }) as HTMLAnchorElement;
    expect(link).toBeInTheDocument();
    expect(link.href.startsWith('waze://?navigate=yes&q=')).toBe(true);
    const encoded = link.href.split('q=')[1];
    expect(decodeURIComponent(encoded)).toContain(baseProps.address);
  });

  test('matches snapshot', () => {
    const { container } = render(<TaskCard {...baseProps} />);
    expect(container).toMatchSnapshot();
  });

  test('shows secondary driver badge when isSecondaryDriver is true', () => {
    render(<TaskCard {...baseProps} isSecondaryDriver={true} />);
    expect(screen.getByText('נהג משני')).toBeInTheDocument();
  });

  test('does not show secondary driver badge when isSecondaryDriver is false or undefined', () => {
    const { rerender } = render(<TaskCard {...baseProps} />);
    expect(screen.queryByText('נהג משני')).not.toBeInTheDocument();

    rerender(<TaskCard {...baseProps} isSecondaryDriver={false} />);
    expect(screen.queryByText('נהג משני')).not.toBeInTheDocument();
  });
});
