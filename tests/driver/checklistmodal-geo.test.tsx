import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChecklistModal, ChecklistSchema } from '@/components/driver/ChecklistModal';

describe('ChecklistModal geolocation best-effort', () => {
  const schema: ChecklistSchema = [
    { id: 'agree', type: 'boolean', title: 'אני מאשר', required: true },
    { id: 'name', type: 'string', title: 'שם מלא', required: true },
  ];

  afterEach(() => {
    // @ts-ignore
    delete (global.navigator as any).geolocation;
  });

  test('includes gps_location on success', async () => {
    const onSubmit = jest.fn();
    // Mock geolocation success
    const mockGeo = {
      getCurrentPosition: (success: PositionCallback) => {
        success({
          coords: {
            latitude: 32.0853,
            longitude: 34.7818,
            accuracy: 12,
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
          } as any,
          timestamp: Date.now(),
        } as GeolocationPosition);
      },
    };
    // @ts-ignore
    (global.navigator as any).geolocation = mockGeo;

    render(<ChecklistModal open onOpenChange={() => {}} schema={schema} onSubmit={onSubmit} />);

    await userEvent.click(screen.getByRole('checkbox', { name: /אני מאשר/ }));
    await userEvent.type(screen.getByRole('textbox', { name: /שם מלא/ }), ' בדיקה');
    await userEvent.click(screen.getByRole('button', { name: 'שמור' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const payload = onSubmit.mock.calls[0][0];
    expect(payload.gps_location).toBeTruthy();
    expect(payload.gps_location.lat).toBeCloseTo(32.0853);
    expect(payload.gps_location.lng).toBeCloseTo(34.7818);
    expect(payload.gps_location.accuracy).toBe(12);
  });

  test('submits without gps_location when geolocation not available', async () => {
    const onSubmit = jest.fn();
    // no geolocation set

    render(<ChecklistModal open onOpenChange={() => {}} schema={schema} onSubmit={onSubmit} />);

    await userEvent.click(screen.getByRole('checkbox', { name: /אני מאשר/ }));
    await userEvent.type(screen.getByRole('textbox', { name: /שם מלא/ }), ' בדיקה');
    await userEvent.click(screen.getByRole('button', { name: 'שמור' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const payload = onSubmit.mock.calls[0][0];
    expect(payload.gps_location).toBeUndefined();
  });
});


