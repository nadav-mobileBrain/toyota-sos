import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { TaskDetails } from '@/components/driver/TaskDetails';

// Mock feature flag to enforce signature
jest.mock('@/lib/useFeatureFlag', () => ({
  useFeatureFlag: (key: string) => {
    if (key === 'signature_required') return true;
    return false;
  },
}));

// Mock SignaturePad to a simple button that triggers onUploaded
jest.mock('@/components/driver/SignaturePad', () => ({
  SignaturePad: ({ onUploaded }: { onUploaded: (meta: any) => void }) => (
    <button onClick={() => onUploaded({ path: 'signatures/t1/20250101/mock.png', bytes: 123 })}>
      Mock Sign
    </button>
  ),
}));

// Mock Supabase browser client
const updateMock = jest.fn().mockReturnValue({ error: null });
const eqMock = jest.fn().mockImplementation(() => ({ error: null }));
const fromMock = jest.fn().mockImplementation(() => ({
  update: (obj: any) => {
    updateMock(obj);
    return { eq: eqMock };
  },
}));
const rpcMock = jest.fn().mockResolvedValue({
  data: [
    {
      id: 't1',
      title: 'Task One',
      type: 'pickup_or_dropoff_car',
      priority: 'medium',
      status: 'in_progress',
      details: 'details',
      estimated_start: '2025-01-01T08:00:00Z',
      estimated_end: '2025-01-01T12:00:00Z',
      address: 'Tel Aviv',
      client_name: 'Foo',
      vehicle_plate: '11-222-33',
      vehicle_model: 'Corolla',
      updated_at: '2025-01-01T09:00:00Z',
    },
  ],
  error: null,
});

jest.mock('@/lib/auth', () => {
  return {
    createBrowserClient: () => ({
      rpc: rpcMock,
      from: fromMock,
    }),
    getDriverSession: jest.fn().mockReturnValue({
      employeeId: '123',
      userId: 'u1',
      role: 'driver',
    }),
  };
});

describe('TaskDetails signature-required completion', () => {
  beforeEach(() => {
    updateMock.mockClear();
    eqMock.mockClear();
    fromMock.mockClear();
    rpcMock.mockClear();
  });

  test('requires signature before enabling completion', async () => {
    render(<TaskDetails taskId="t1" />);

    // Wait for content to load
    await screen.findByText('סיום משימה');
    // Expand the completion section
    fireEvent.click(screen.getByRole('button', { name: /סיום משימה/i }));

    let completeBtn = await screen.findByRole('button', { name: 'סמן כהושלם' }) as HTMLButtonElement;
    expect(completeBtn).toBeDisabled();

    // Click our mocked "Sign" button to simulate upload
    fireEvent.click(screen.getByText('Mock Sign'));

    // Now completion should be enabled (re-query after state update)
    completeBtn = await screen.findByRole('button', { name: 'סמן כהושלם' }) as HTMLButtonElement;
    await waitFor(() => expect(completeBtn.disabled).toBe(false));

    fireEvent.click(completeBtn);

    await waitFor(() => {
      // ensure update called to mark completed via RPC
      expect(rpcMock).toHaveBeenCalledWith('update_task_status', expect.objectContaining({
        p_task_id: 't1',
        p_status: 'completed',
        p_driver_id: 'u1'
      }));
    });
  });
});


