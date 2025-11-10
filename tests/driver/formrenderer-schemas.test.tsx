import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FormRenderer, type FormSchema } from '@/components/driver/FormRenderer';

describe('FormRenderer multi-schema coverage', () => {
  const simpleSchema: FormSchema = [
    { id: 'name', type: 'text', title: 'שם', required: true },
    { id: 'notes', type: 'textarea', title: 'הערות' },
  ];

  const conditionalSchema: FormSchema = [
    { id: 'toggle', type: 'checkbox', title: 'הצג פרטים' },
    {
      id: 'details',
      type: 'text',
      title: 'פרטים',
      dependsOn: { when: 'all', rules: [{ fieldId: 'toggle', operator: 'equals', value: true }] },
    },
  ];

  const mixedSchema: FormSchema = [
    { id: 'fullName', type: 'text', title: 'שם מלא', required: true, constraints: { minLength: 2 } },
    { id: 'count', type: 'number', title: 'כמות', constraints: { min: 1, max: 10 } },
    {
      id: 'kind',
      type: 'select',
      title: 'סוג',
      options: [
        { value: 1, label: 'אחד' },
        { value: 2, label: 'שתיים' },
      ],
    },
    {
      id: 'level',
      type: 'radio',
      title: 'רמה',
      options: [
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B' },
      ],
    },
    { id: 'when', type: 'date', title: 'תאריך' },
    { id: 'time', type: 'time', title: 'שעה' },
  ];

  test('simple schema renders and matches snapshot', () => {
    const { container } = render(<FormRenderer schema={simpleSchema} />);
    expect(container).toMatchSnapshot();
  });

  test('conditional schema toggles visibility', async () => {
    render(<FormRenderer schema={conditionalSchema} />);
    expect(screen.queryByLabelText('פרטים')).not.toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('הצג פרטים'));
    expect(await screen.findByLabelText('פרטים')).toBeInTheDocument();
  });

  test('mixed schema normalizes payload', async () => {
    const onSubmit = jest.fn();
    render(<FormRenderer schema={mixedSchema} onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText(/שם מלא/), 'אב');
    await userEvent.clear(screen.getByLabelText(/כמות/));
    await userEvent.type(screen.getByLabelText(/כמות/), '3');
    await userEvent.selectOptions(screen.getByLabelText(/סוג/), '2');
    await userEvent.click(screen.getByLabelText('B'));
    await userEvent.type(screen.getByLabelText(/תאריך/), '2025-02-01');
    await userEvent.type(screen.getByLabelText(/שעה/), '10:15');

    await userEvent.click(screen.getByRole('button', { name: 'שמור' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
      const payload = onSubmit.mock.calls[0][0];
      expect(payload.fullName).toBe('אב');
      expect(payload.count).toBe(3);
      expect(payload.kind).toBe(2);
      expect(payload.level).toBe('b');
      expect(payload.when).toBe('2025-02-01');
      expect(payload.time).toBe('10:15');
    });
  });
});


