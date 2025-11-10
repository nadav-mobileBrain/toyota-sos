import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TaskDetails } from '@/components/driver/TaskDetails';

// Mock Supabase browser client RPC
const rpcMock = jest.fn();
jest.mock('@/lib/auth', () => {
  return {
    createBrowserClient: () => ({
      rpc: rpcMock,
    }),
  };
});

describe('TaskDetails a11y and collapsible behavior', () => {
  const taskId = '00000000-0000-0000-0000-000000000002';

  beforeEach(() => {
    rpcMock.mockReset();
    rpcMock.mockResolvedValue({
      data: [
        {
          id: taskId,
          title: 'תיקון צמיג',
          type: 'other',
          priority: 'medium',
          status: 'pending',
          details: 'פרטי עבודה',
          estimated_start: null,
          estimated_end: null,
          address: 'רחוב הבנים 10, הרצליה',
          client_name: 'ישראל ישראלי',
          vehicle_plate: '77-888-99',
          vehicle_model: 'Yaris',
          updated_at: new Date().toISOString(),
        },
      ],
      error: null,
    });
  });

  test('sections have role=region and are labelled by their toggle button', async () => {
    const { container } = render(<TaskDetails taskId={taskId} />);
    // Wait for header text
    expect(await screen.findByText('תיקון צמיג')).toBeInTheDocument();

    // Pick the "פרטים" section toggle button
    const detailsButton = screen.getByRole('button', { name: /פרטים/ });
    const section = detailsButton.closest('section');
    expect(section).toBeTruthy();
    if (section) {
      expect(section.getAttribute('role')).toBe('region');
      const labelledBy = section.getAttribute('aria-labelledby');
      expect(labelledBy).toBe(detailsButton.id);
    }
  });

  test('aria-expanded toggles and panel hides/shows content', async () => {
    render(<TaskDetails taskId={taskId} />);
    // Wait for header to ensure data loaded
    expect(await screen.findByText('תיקון צמיג')).toBeInTheDocument();

    let detailsButton = screen.getByRole('button', { name: /פרטים/ });
    const initiallyVisible = !!screen.queryByText('פרטי עבודה');
    // Toggle once
    await userEvent.click(detailsButton);
    if (initiallyVisible) {
      await waitFor(() => expect(screen.queryByText('פרטי עבודה')).toBeNull());
      detailsButton = screen.getByRole('button', { name: /פרטים/ });
      expect(detailsButton).toHaveAttribute('aria-expanded', 'false');
    } else {
      await screen.findByText('פרטי עבודה');
      detailsButton = screen.getByRole('button', { name: /פרטים/ });
      expect(detailsButton).toHaveAttribute('aria-expanded', 'true');
    }
    // Toggle back
    await userEvent.click(detailsButton);
    if (initiallyVisible) {
      await screen.findByText('פרטי עבודה');
      detailsButton = screen.getByRole('button', { name: /פרטים/ });
      expect(detailsButton).toHaveAttribute('aria-expanded', 'true');
    } else {
      await waitFor(() => expect(screen.queryByText('פרטי עבודה')).toBeNull());
      detailsButton = screen.getByRole('button', { name: /פרטים/ });
      expect(detailsButton).toHaveAttribute('aria-expanded', 'false');
    }
  });
});


