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
  act,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TaskDialog } from '@/components/admin/TaskDialog';
import { toastError } from '@/lib/toast';

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
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ data: { id: 't1' } }),
  })
) as jest.Mock;

describe('TaskDialog Validation for Replacement Car Delivery', () => {
  const mockDrivers = [{ id: 'd1', name: 'Driver 1' }];
  const mockClients = [{ id: 'c1', name: 'Client 1', phone: '050-1234567' }];
  const mockVehicles = [
    { id: 'v1', license_plate: '11-222-33', model: 'Toyota' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('validates that client is required; vehicle not required without lead driver', async () => {
    render(
      <TaskDialog
        open={true}
        onOpenChange={() => {}}
        mode="create"
        task={null}
        drivers={mockDrivers as any}
        clients={mockClients as any}
        vehicles={mockVehicles as any}
        clientVehicles={[] as any}
      />
    );

    // 1. Select type 'מסירת רכב חלופי'
    // TaskDialog uses a dropdown button (label isn't associated to a form control)
    const typeLabel = screen.getByText('סוג משימה');
    const typeContainer = typeLabel.parentElement;
    expect(typeContainer).toBeTruthy();
    const typeTrigger = typeContainer!.querySelector('button');
    expect(typeTrigger).toBeTruthy();
    await userEvent.click(typeTrigger as HTMLElement);

    // The options are usually in a portal. We need to find the option.
    const typeOption = await screen.findByText('מסירת רכב חלופי');
    await userEvent.click(typeOption);

    // 2. Try to submit
    const submitBtn = screen.getByRole('button', { name: 'צור משימה' });
    await userEvent.click(submitBtn);

    // 3. Expect error toast
    expect(toastError).toHaveBeenCalledWith(
      expect.stringContaining('חובה לבחור לקוח')
    );

    // 4. Select Client
    // Assuming the client input is accessible by label "לקוח"
    const clientInput = screen.getByPlaceholderText('לקוח');
    await userEvent.type(clientInput, 'Client 1');
    const clientSuggestion = await screen.findByText('Client 1');
    await userEvent.click(clientSuggestion);

    // Depending on implementation, we might need to select from suggestions.
    // If TaskDialog matches exact string 'Client 1' to mockClients, it works.

    // Try submit again
    await userEvent.click(submitBtn);
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  test('requires agency vehicle when lead driver is selected', async () => {
    render(
      <TaskDialog
        open={true}
        onOpenChange={() => {}}
        mode="create"
        task={null}
        drivers={mockDrivers as any}
        clients={mockClients as any}
        vehicles={mockVehicles as any}
        clientVehicles={[] as any}
      />
    );

    const typeLabel = screen.getByText('סוג משימה');
    const typeContainer = typeLabel.parentElement;
    expect(typeContainer).toBeTruthy();
    const typeTrigger = typeContainer!.querySelector('button');
    expect(typeTrigger).toBeTruthy();
    await userEvent.click(typeTrigger as HTMLElement);
    const typeOption = await screen.findByText('מסירת רכב חלופי');
    await userEvent.click(typeOption);

    const submitBtn = screen.getByRole('button', { name: 'צור משימה' });

    const clientInput = screen.getByPlaceholderText('לקוח');
    await userEvent.type(clientInput, 'Client 1');
    const clientSuggestion = await screen.findByText('Client 1');
    await userEvent.click(clientSuggestion);

    // Select lead driver
    const leadDriverLabel = screen.getByText('נהג מוביל');
    const leadDriverContainer = leadDriverLabel.closest('label');
    expect(leadDriverContainer).toBeTruthy();
    const leadDriverButton = leadDriverContainer!.querySelector('button');
    expect(leadDriverButton).toBeTruthy();
    await userEvent.click(leadDriverButton as HTMLElement);
    const driverOption = await screen.findByText('Driver 1');
    await userEvent.click(driverOption);

    // Now vehicle becomes required
    await userEvent.click(submitBtn);
    expect(toastError).toHaveBeenCalledWith(
      'חובה לבחור רכב עבור משימת מסירת רכב חלופי'
    );

    // Select Vehicle and submit should succeed
    const vehicleInput = screen.getByPlaceholderText('רכב סוכנות');
    await userEvent.type(vehicleInput, '11-222-33');

    await userEvent.click(submitBtn);
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
  });
});

describe('TaskDialog Validation for Test Execution (ביצוע טסט)', () => {
  const mockDrivers = [{ id: 'd1', name: 'Driver 1' }];
  const mockClients = [{ id: 'c1', name: 'Client 1', phone: '050-1234567' }];
  const mockVehicles = [
    { id: 'v1', license_plate: '11-222-33', model: 'Toyota' },
  ];
  const mockClientVehicles = [
    {
      id: 'cv1',
      client_id: 'c1',
      license_plate: '99-888-77',
      model: 'Corolla',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('does not require agency/client vehicle when no lead driver is selected', async () => {
    render(
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

    const typeLabel = screen.getByText('סוג משימה');
    const typeContainer = typeLabel.parentElement;
    expect(typeContainer).toBeTruthy();
    const typeTrigger = typeContainer!.querySelector('button');
    expect(typeTrigger).toBeTruthy();
    await userEvent.click(typeTrigger as HTMLElement);
    const typeOption = await screen.findByText('ביצוע טסט');
    await userEvent.click(typeOption);

    const submitBtn = screen.getByRole('button', { name: 'צור משימה' });
    await userEvent.click(submitBtn);
    expect(toastError).toHaveBeenCalledWith(
      expect.stringContaining('חובה לבחור לקוח')
    );

    const clientInput = screen.getByPlaceholderText('לקוח');
    await userEvent.type(clientInput, 'Client 1');
    const clientSuggestion = await screen.findByText('Client 1');
    await userEvent.click(clientSuggestion);

    // No lead driver, no vehicles selected -> should submit successfully
    await userEvent.click(submitBtn);
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  test('requires at least one vehicle (agency OR client) when lead driver is selected', async () => {
    render(
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

    const typeLabel = screen.getByText('סוג משימה');
    const typeContainer = typeLabel.parentElement;
    expect(typeContainer).toBeTruthy();
    const typeTrigger = typeContainer!.querySelector('button');
    expect(typeTrigger).toBeTruthy();
    await userEvent.click(typeTrigger as HTMLElement);
    const typeOption = await screen.findByText('ביצוע טסט');
    await userEvent.click(typeOption);

    const submitBtn = screen.getByRole('button', { name: 'צור משימה' });

    const clientInput = screen.getByPlaceholderText('לקוח');
    await userEvent.type(clientInput, 'Client 1');
    const clientSuggestion = await screen.findByText('Client 1');
    await userEvent.click(clientSuggestion);

    // Select lead driver
    const leadDriverLabel = screen.getByText('נהג מוביל');
    const leadDriverContainer = leadDriverLabel.closest('label');
    expect(leadDriverContainer).toBeTruthy();
    const leadDriverButton = leadDriverContainer!.querySelector('button');
    expect(leadDriverButton).toBeTruthy();
    await userEvent.click(leadDriverButton as HTMLElement);
    const driverOption = await screen.findByText('Driver 1');
    await userEvent.click(driverOption);

    // No vehicles selected -> should error
    await userEvent.click(submitBtn);
    expect(toastError).toHaveBeenCalledWith(
      'חובה לבחור רכב (סוכנות או לקוח) עבור משימת ביצוע טסט'
    );

    // Select CLIENT vehicle only (should satisfy "either one")
    const clientVehicleInput = screen.getByPlaceholderText(
      'רכב לקוח (חפש לפי מספר רישוי או דגם)'
    );
    await userEvent.type(clientVehicleInput, '99-888-77');
    const clientVehicleSuggestion = await screen.findByText(/99-888-77/);
    await userEvent.click(clientVehicleSuggestion);

    await userEvent.click(submitBtn);
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
  });
});
