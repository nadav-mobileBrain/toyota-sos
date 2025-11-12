import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DashboardKPIs } from '@/components/admin/dashboard/DashboardKPIs';

jest.mock('@/utils/csv', () => {
  return {
    toCsv: jest.fn(() => '\uFEFFa,b\n1,2'),
    downloadCsv: jest.fn(),
    makeCsvFilename: jest.fn(() => 'dashboard_all_20250115_101112_UTC.csv'),
  };
});

const { downloadCsv } = jest.requireMock('@/utils/csv');

describe('Dashboard export-all CSV button', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    // Mock global fetch for dashboard summary API
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          summary: {
            tasksCreated: 5,
            tasksCompleted: 3,
            overdueCount: 1,
            onTimeRatePct: 60,
          },
          datasets: {
            createdCompletedSeries: [{ date: '2025-01-01', created: 2, completed: 1 }],
            overdueByDriver: [{ driver_id: 'd1', driver_name: 'Driver 1', overdue: 1 }],
            onTimeVsLate: { onTime: 3, late: 2 },
            funnel: [
              { step: 'assigned', count: 5 },
              { step: 'started', count: 4 },
              { step: 'completed', count: 3 },
            ],
          },
        },
      }),
    } as any);
  });

  it('exports a combined CSV when clicking the top-left export button', async () => {
    render(<DashboardKPIs />);

    // Wait until data is loaded by checking a KPI value shows up
    await waitFor(() => expect(screen.getByText('5')).toBeInTheDocument());

    const btn = screen.getByRole('button', { name: 'ייצוא CSV כולל' });
    fireEvent.click(btn);

    await waitFor(() => {
      expect(downloadCsv).toHaveBeenCalled();
    });
  });
});


