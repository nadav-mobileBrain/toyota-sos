import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuditFeed } from '../../components/admin/AuditFeed';

const originalFetch = global.fetch;

function mockAuditResponse(data: any[], status = 200) {
  (global.fetch as any) = jest.fn().mockImplementation((url: string) => {
    if (url.includes('/api/admin/tasks/')) {
      return Promise.resolve({
        ok: status === 200,
        status,
        json: async () => ({ data }),
        text: async () => 'err',
      });
    }
    // profiles fallback
    return Promise.resolve({
      ok: true,
      json: async () => [],
    });
  });
}

describe('AuditFeed', () => {
  beforeEach(() => {
    (global as any).fetch = originalFetch;
    jest.restoreAllMocks();
  });

  test('renders audit entries, RTL and pagination', async () => {
    const rows = [
      {
        id: '1',
        task_id: 't1',
        actor_id: 'u1',
        action: 'updated',
        changed_at: '2025-01-01T00:00:00.000Z',
        before: { title: 'Old' },
        after: { title: 'New' },
        diff: { title: { from: 'Old', to: 'New' } },
      },
    ];
    mockAuditResponse(rows);
    render(<AuditFeed taskId="t1" pageSize={1} />);
    await screen.findByRole('region', { name: /פיד שינויים/i });
    // RTL container
    const region = screen.getByRole('region', { name: /פיד שינויים/i });
    expect(region).toHaveAttribute('dir', 'rtl');
    // Row fields
    expect(await screen.findByText('עודכן')).toBeInTheDocument();
    expect(screen.getByText(/title/i)).toBeInTheDocument();
    // Pagination buttons visible
    expect(screen.getByRole('button', { name: 'דף הבא' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'דף קודם' })).toBeInTheDocument();
  });

  test('filters by action and searches diff', async () => {
    const rows = [
      {
        id: '1',
        task_id: 't1',
        actor_id: 'u1',
        action: 'created',
        changed_at: '2025-01-01T00:00:00.000Z',
        before: null,
        after: { title: 'Hello' },
        diff: { title: { from: null, to: 'Hello' } },
      },
      {
        id: '2',
        task_id: 't1',
        actor_id: 'u2',
        action: 'updated',
        changed_at: '2025-01-02T00:00:00.000Z',
        before: { title: 'Hello' },
        after: { title: 'World' },
        diff: { title: { from: 'Hello', to: 'World' } },
      },
    ];
    mockAuditResponse(rows);
    render(<AuditFeed taskId="t1" pageSize={5} />);
    await screen.findByRole('region', { name: /פיד שינויים/i });
    // Filter by 'created'
    fireEvent.change(screen.getByLabelText('סינון פעולה'), { target: { value: 'created' } });
    await waitFor(() => {
      expect(screen.getAllByText('נוצר').length).toBeGreaterThan(0);
    });
    // Search for 'World'
    fireEvent.change(screen.getByLabelText('חפש'), { target: { value: 'World' } });
    await waitFor(() => {
      expect(screen.getAllByText('עודכן').length).toBeGreaterThan(0);
    });
  });

  test('handles unauthorized', async () => {
    mockAuditResponse([], 401);
    render(<AuditFeed taskId="t1" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('לא מורשה');
  });
});


