// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock scrollIntoView
window.HTMLElement.prototype.scrollIntoView = jest.fn();
window.HTMLElement.prototype.releasePointerCapture = jest.fn();
window.HTMLElement.prototype.hasPointerCapture = jest.fn();

import React from 'react';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
  act,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TaskDialog } from '@/components/admin/TaskDialog';
import { toastError, toastSuccess } from '@/lib/toast';

// Mock dependencies
jest.mock('@/lib/useFeatureFlag', () => ({
  useFeatureFlag: () => true, // enable all flags
}));

jest.mock('@/lib/toast', () => ({
  toastSuccess: jest.fn(),
  toastError: jest.fn(),
}));

jest.mock('@/lib/events', () => ({
  trackFormSubmitted: jest.fn(),
}));

jest.mock('@/utils/pdf', () => ({
  downloadBlob: jest.fn(),
  generateTaskPdfLikeBlob: jest.fn(),
}));

// Mock fetch
global.fetch = jest.fn() as jest.Mock;

describe('TaskDialog Validation for Mobility Return (החזרת רכב מוביליטי)', () => {
  const mockDrivers = [{ id: 'd1', name: 'Driver 1' }];
  const mockClients = [{ id: 'c1', name: 'Client 1', phone: '0501234567' }];
  const mockVehicles = [
    { id: 'v1', license_plate: '1122233', model: 'Toyota Corolla' },
  ];
  const mockClientVehicles = [
    { id: 'cv1', license_plate: '8877766', model: 'Mazda 3', client_id: 'c1' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockImplementation((url) => {
      if (url.includes('/api/admin/tasks')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: { id: 't1' } }),
        });
      }
      if (url.includes('/api/admin/clients') && !url.includes('vehicles')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: { id: 'new-c1', name: 'New Client Name', phone: '0549998877' } }),
        });
      }
      if (url.includes('/api/admin/clients-vehicles')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: { id: 'new-cv1', license_plate: '1234567' } }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
  });

  const setup = () => {
    return render(
      <TaskDialog
        open={true}
        onOpenChange={() => {}}
        mode="create"
        task={null}
        drivers={mockDrivers as any}
        clients={mockClients as any}
        vehicles={mockVehicles as any}
        clientVehicles={mockClientVehicles as any}
      />
    );
  };

  test('validates all required fields for החזרת רכב מוביליטי', async () => {
    setup();

    // 1. Select task type
    const typeTrigger = screen.getByRole('button', { name: 'אחר' });
    await userEvent.click(typeTrigger);
    const typeOption = await screen.findByText('החזרת רכב מוביליטי');
    await userEvent.click(typeOption);

    const submitBtn = screen.getByRole('button', { name: /צור משימה/i });

    // 2. Validate Client (Required)
    await userEvent.click(submitBtn);
    expect(toastError).toHaveBeenCalledWith('חובה לבחור לקוח עבור משימת החזרת רכב מוביליטי');

    // Select existing client
    const clientInput = screen.getByLabelText(/^לקוח/i);
    await userEvent.type(clientInput, 'Client 1');
    const clientSuggestion = await screen.findByText('Client 1');
    await userEvent.click(clientSuggestion);

    // 3. Validate Client Vehicle (Required)
    await userEvent.click(submitBtn);
    expect(toastError).toHaveBeenCalledWith('חובה לבחור רכב לקוח עבור משימת החזרת רכב מוביליטי');

    // Enter client vehicle and select from suggestion
    const vehicleInput = screen.getByPlaceholderText(/רכב לקוח \(חפש לפי מספר רישוי או דגם\)/i);
    await userEvent.type(vehicleInput, '8877766');
    const vehicleSuggestion = await screen.findByText(/88-777-66/);
    await userEvent.click(vehicleSuggestion);

    // 4. Validate Address (Required)
    await userEvent.click(submitBtn);
    expect(toastError).toHaveBeenCalledWith('חובה להזין כתובת עבור משימת החזרת רכב מוביליטי');

    const addressInput = screen.getByPlaceholderText(/הקלד כתובת/i);
    await userEvent.type(addressInput, 'Main St 1, Tel Aviv');

    // 5. Success (Advisor NOT required)
    await userEvent.click(submitBtn);
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/admin/tasks'),
        expect.any(Object)
      );
    });
    expect(toastSuccess).toHaveBeenCalled();
  });
});
