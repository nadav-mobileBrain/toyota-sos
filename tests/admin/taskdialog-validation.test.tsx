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
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
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
  const mockClients = [{ id: 'c1', name: 'Client 1' }];
  const mockVehicles = [{ id: 'v1', license_plate: '11-222-33', model: 'Toyota' }];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('validates that client and vehicle are required for replacement_car_delivery', async () => {
    render(
      <TaskDialog
        open={true}
        onOpenChange={() => {}}
        mode="create"
        task={null}
        drivers={mockDrivers as any}
        clients={mockClients as any}
        vehicles={mockVehicles as any}
      />
    );

    // 1. Select type 'מסירת רכב חלופי'
    // Radix UI Select typically uses a button trigger
    // We can try finding by label text if associated, or just by the placeholder text "בחר סוג משימה" or current value.
    // The label is "סוג משימה".
    const typeTrigger = screen.getByLabelText(/סוג משימה/i);
    await userEvent.click(typeTrigger);
    
    // The options are usually in a portal. We need to find the option.
    const typeOption = await screen.findByText('מסירת רכב חלופי');
    await userEvent.click(typeOption);

    // 2. Try to submit
    const submitBtn = screen.getByRole('button', { name: 'צור משימה' });
    await userEvent.click(submitBtn);

    // 3. Expect error toast
    expect(toastError).toHaveBeenCalledWith('חובה לבחור לקוח עבור משימת מסירת רכב חלופי');
    
    // 4. Select Client
    // Assuming the client input is accessible by label "לקוח"
    const clientInput = screen.getByLabelText('לקוח');
    await userEvent.type(clientInput, 'Client 1');
    
    // Depending on implementation, we might need to select from suggestions.
    // If TaskDialog matches exact string 'Client 1' to mockClients, it works.
    
    // Try submit again
    await userEvent.click(submitBtn);
    expect(toastError).toHaveBeenCalledWith('חובה לבחור רכב עבור משימת מסירת רכב חלופי');

    // 5. Select Vehicle
    const vehicleInput = screen.getByLabelText('רכב');
    await userEvent.type(vehicleInput, '11-222-33');

    // 6. Submit success
    await userEvent.click(submitBtn);
    
    await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
    });
  });
});
