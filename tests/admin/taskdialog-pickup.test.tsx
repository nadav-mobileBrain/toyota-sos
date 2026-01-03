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

describe('TaskDialog Validation for Pickup Vehicle / Transport (איסוף רכב/שינוע)', () => {
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

  test('validates all required fields for איסוף רכב/שינוע', async () => {
    setup();

    // 1. Select task type
    const typeTrigger = screen.getByRole('button', { name: /סוג/i });
    await userEvent.click(typeTrigger);
    const typeOption = await screen.findByText('איסוף רכב/שינוע');
    await userEvent.click(typeOption);

    const submitBtn = screen.getByRole('button', { name: /צור משימה/i });

    // 2. Validate General fields (Phone required if no client selected)
    await userEvent.click(submitBtn);
    expect(toastError).toHaveBeenCalledWith('חובה להזין טלפון עבור משימה זו');

    // Select existing client
    const clientInput = screen.getByLabelText(/^לקוח/i);
    await userEvent.type(clientInput, 'Client 1');
    const clientSuggestion = await screen.findByText('Client 1');
    await userEvent.click(clientSuggestion);

    // 3. Validate Client Vehicle
    await userEvent.click(submitBtn);
    expect(toastError).toHaveBeenCalledWith('חובה לבחור רכב לקוח עבור משימת איסוף רכב/שינוע');

    // Enter client vehicle and select from suggestion
    const vehicleInput = screen.getByPlaceholderText(/רכב לקוח \(חפש לפי מספר רישוי או דגם\)/i);
    await userEvent.type(vehicleInput, '8877766');
    const vehicleSuggestion = await screen.findByText(/88-777-66/);
    await userEvent.click(vehicleSuggestion);

    // 4. Validate Address
    await userEvent.click(submitBtn);
    expect(toastError).toHaveBeenCalledWith('חובה להזין כתובת עבור משימת איסוף רכב/שינוע');

    const addressInput = screen.getByPlaceholderText(/הקלד כתובת/i);
    await userEvent.type(addressInput, 'Main St 1, Tel Aviv');

    // 5. Validate Advisor
    await userEvent.click(submitBtn);
    expect(toastError).toHaveBeenCalledWith('חובה להזין שם יועץ או לבחור צבע יועץ עבור משימת איסוף רכב/שינוע');

    const advisorInput = screen.getByPlaceholderText(/הזן שם יועץ/i);
    await userEvent.type(advisorInput, 'Advisor 1');

    // 6. Success
    await userEvent.click(submitBtn);
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/admin/tasks'),
        expect.any(Object)
      );
    });
    expect(toastSuccess).toHaveBeenCalled();
  });

  test('creates a task with a new client and new vehicle', async () => {
    setup();

    // Select task type
    const typeTrigger = screen.getByRole('button', { name: /סוג/i });
    await userEvent.click(typeTrigger);
    const typeOption = await screen.findByText('איסוף רכב/שינוע');
    await userEvent.click(typeOption);

    // Click "New Client"
    const newButtons = screen.getAllByRole('button', { name: /חדש/i });
    await userEvent.click(newButtons[0]);

    // Fill new client details
    const nameInput = screen.getByPlaceholderText('שם');
    // Find the phone input that is NOT the main one (main one has aria-label or is further down)
    const phoneInputs = screen.getAllByPlaceholderText('טלפון');
    // The "New Client" form is usually index 0 in this context as it appears before the main fields in the grid
    const phoneInput = phoneInputs[0]; 
    
    await userEvent.type(nameInput, 'New Client Name');
    await userEvent.type(phoneInput, '0549998877');
    
    const createClientBtn = screen.getByRole('button', { name: 'צור' });
    await userEvent.click(createClientBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/admin/clients'),
        expect.objectContaining({ method: 'POST' })
      );
    });

    // Wait for state updates after client creation
    // The dialog should now show the new client name in the main client field
    await waitFor(() => {
      expect(screen.getByLabelText(/^לקוח/i)).toHaveValue('New Client Name');
    });

    // Fill address
    const addressInput = screen.getByPlaceholderText(/הקלד כתובת/i);
    await userEvent.type(addressInput, 'New Address');

    // Click "New Vehicle"
    await userEvent.click(newButtons[1]);
    const plateInput = screen.getByPlaceholderText(/7 או 8 ספרות/i);
    const modelInput = screen.getByPlaceholderText('דגם');
    await userEvent.type(plateInput, '1234567');
    await userEvent.type(modelInput, 'Tesla Model 3');
    
    const addVehicleBtn = screen.getByRole('button', { name: 'הוסף' });
    await userEvent.click(addVehicleBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/admin/clients-vehicles'),
        expect.objectContaining({ method: 'POST' })
      );
    });

    // Fill advisor
    const advisorInput = screen.getByPlaceholderText(/הזן שם יועץ/i);
    await userEvent.type(advisorInput, 'New Advisor');

    // Submit
    const submitBtn = screen.getByRole('button', { name: /צור משימה/i });
    await userEvent.click(submitBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/admin/tasks'),
        expect.objectContaining({ method: 'POST' })
      );
    });
    expect(toastSuccess).toHaveBeenCalled();
  });
});
