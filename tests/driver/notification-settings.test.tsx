import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import NotificationSettingsPage from '@/app/settings/notifications/page';

const createBrowserClientMock = jest.fn();
const getDriverSessionMock = jest.fn();
const selectMock = jest.fn();
const upsertMock = jest.fn();

jest.mock('@/lib/auth', () => ({
  createBrowserClient: (...args: any[]) => createBrowserClientMock(...args),
  getDriverSession: (...args: any[]) => getDriverSessionMock(...args),
}));

describe('Notification Settings (6.7)', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Supabase client with proper chainable mocks
    selectMock.mockReturnValue({
      eq: jest.fn().mockResolvedValue({
        data: [
          { id: '1', user_id: 'user1', event_type: 'assigned', enabled: true },
          { id: '2', user_id: 'user1', event_type: 'updated', enabled: false },
        ],
        error: null,
      }),
    });

    createBrowserClientMock.mockReturnValue({
      from: jest.fn().mockReturnValue({
        select: selectMock,
        upsert: upsertMock,
      }),
    });

    getDriverSessionMock.mockReturnValue({
      userId: 'user1',
      employeeId: 'D0001',
      role: 'driver',
    });

    upsertMock.mockResolvedValue({ error: null });
  });

  test('loads and displays preferences with checkboxes', async () => {
    render(<NotificationSettingsPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'הגדרות התראות' })).toBeInTheDocument();
    });

    // Check that event type labels appear
    expect(screen.getByText('משימה הוקצתה')).toBeInTheDocument();
    expect(screen.getByText('משימה עודכנה')).toBeInTheDocument();
    expect(screen.getByText('משימה התחילה')).toBeInTheDocument();

    // Verify initial state (assigned=true, updated=false)
    const assignedCheckbox = screen.getByRole('checkbox', { name: /משימה הוקצתה/i }) as HTMLInputElement;
    const updatedCheckbox = screen.getByRole('checkbox', { name: /משימה עודכנה/i }) as HTMLInputElement;
    expect(assignedCheckbox.checked).toBe(true);
    expect(updatedCheckbox.checked).toBe(false);
  });

  test('toggles preference checkbox and saves', async () => {
    render(<NotificationSettingsPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'הגדרות התראות' })).toBeInTheDocument();
    });

    // Toggle "updated" from false to true
    const updatedCheckbox = screen.getByRole('checkbox', { name: /משימה עודכנה/i });
    fireEvent.click(updatedCheckbox);

    expect((updatedCheckbox as HTMLInputElement).checked).toBe(true);

    // Click save
    const saveBtn = screen.getByRole('button', { name: /שמור הגדרות/i });
    fireEvent.click(saveBtn);

    // Verify upsert called with correct data
    await waitFor(() => {
      expect(upsertMock).toHaveBeenCalled();
    });

    const calls = upsertMock.mock.calls[0];
    const upsertData = calls[0] as any[];
    const updatedPref = upsertData.find((p) => p.event_type === 'updated');
    expect(updatedPref?.enabled).toBe(true);

    // Check success message appears (may be cleared by timeout, so check within waitFor)
    await waitFor(() => {
      expect(screen.getByText(/ההגדרות נשמרו בהצלחה/i)).toBeInTheDocument();
    });
  });

  test('renders all event type options', async () => {
    render(<NotificationSettingsPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'הגדרות התראות' })).toBeInTheDocument();
    });

    const eventTypes = ['משימה הוקצתה', 'משימה עודכנה', 'משימה התחילה', 'משימה הושלמה', 'משימה חסומה'];
    eventTypes.forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
  });

  test('disables save button when no session', async () => {
    getDriverSessionMock.mockReturnValue(null);
    selectMock.mockReturnValue({
      eq: jest.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
    });
    render(<NotificationSettingsPage />);

    // Wait for "טוען" to disappear, then checkboxes to appear
    await waitFor(() => {
      expect(screen.queryByText(/טוען/i)).not.toBeInTheDocument();
    });

    // Should still render all checkboxes (defaults enabled)
    const assignedCheckbox = screen.getByRole('checkbox', { name: /משימה הוקצתה/i });
    expect(assignedCheckbox).toBeInTheDocument();

    // Click save
    const saveBtn = screen.getByRole('button', { name: /שמור הגדרות/i });
    fireEvent.click(saveBtn);

    // upsert should not be called without session
    expect(upsertMock).not.toHaveBeenCalled();
  });
});

