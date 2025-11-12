import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import FeatureFlags from '../../components/admin/FeatureFlags';

const realFetch = global.fetch;

describe('FeatureFlags UI', () => {
  beforeEach(() => {
    (global as any).fetch = jest.fn().mockImplementation((url: string, init?: any) => {
      if (url.includes('/api/admin/flags') && (!init || !init.method || init.method === 'GET')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: [{ key: 'alpha', enabled: false }] }),
        });
      }
      if (url.includes('/api/admin/flags') && init?.method === 'PUT') {
        const body = JSON.parse(init.body);
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: { key: body.key, enabled: body.enabled, updated_at: new Date().toISOString(), updated_by: null } }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
  });
  afterEach(() => {
    (global as any).fetch = realFetch;
  });

  test('lists and toggles a flag', async () => {
    render(<FeatureFlags />);
    // wait for toggle button of alpha to appear (ensures fetch + state update)
    const toggle = await screen.findByRole('button', { name: /החלף דגל alpha/i });
    fireEvent.click(toggle);
    // becomes enabled label
    await waitFor(() => {
      expect(screen.getByText('פעיל')).toBeInTheDocument();
    });
  });

  test('adds a new flag', async () => {
    render(<FeatureFlags />);
    const input = await screen.findByLabelText('מפתח דגל חדש');
    fireEvent.change(input, { target: { value: 'beta' } });
    fireEvent.click(screen.getByRole('button', { name: 'הוסף' }));
    await waitFor(() => {
      expect(screen.getByText('beta')).toBeInTheDocument();
    });
  });
});


