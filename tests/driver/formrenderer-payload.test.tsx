import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FormRenderer, type FormSchema } from '@/components/driver/FormRenderer';

describe('FormRenderer normalized payload', () => {
  test('coerces number/date/time and select numeric option', async () => {
    const onSubmit = jest.fn();
    const onChange = jest.fn();
    const schema: FormSchema = [
      { id: 'qty', type: 'number', title: 'כמות' },
      { id: 'd', type: 'date', title: 'תאריך' },
      { id: 't', type: 'time', title: 'שעה' },
      {
        id: 'choice',
        type: 'select',
        title: 'בחירה',
        options: [
          { value: 1, label: 'אחד' },
          { value: 2, label: 'שתיים' },
        ],
      },
    ];
    render(<FormRenderer schema={schema} onSubmit={onSubmit} onChange={onChange} />);

    await userEvent.type(screen.getByLabelText('כמות'), '42');
    await userEvent.type(screen.getByLabelText('תאריך'), '2025-01-02');
    await userEvent.type(screen.getByLabelText('שעה'), '13:45');
    await userEvent.selectOptions(screen.getByLabelText('בחירה'), '1'); // string '1' maps to numeric 1

    await userEvent.click(screen.getByRole('button', { name: 'שמור' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
      const payload = onSubmit.mock.calls[0][0];
      expect(payload.qty).toBe(42);
      expect(payload.d).toBe('2025-01-02');
      expect(payload.t).toBe('13:45');
      expect(payload.choice).toBe(1);
    });
  });

  test('empty number/date/time become null; hidden excluded', async () => {
    const onSubmit = jest.fn();
    const schema: FormSchema = [
      { id: 'qty', type: 'number', title: 'כמות' },
      { id: 'd', type: 'date', title: 'תאריך' },
      { id: 't', type: 'time', title: 'שעה' },
      { id: 'toggle', type: 'checkbox', title: 'הצג שדה' },
      {
        id: 'hiddenUnlessChecked',
        type: 'text',
        title: 'מוסתר',
        dependsOn: { when: 'all', rules: [{ fieldId: 'toggle', operator: 'equals', value: true }] },
      },
    ];
    render(<FormRenderer schema={schema} onSubmit={onSubmit} />);

    // leave number/date/time empty; dependent field remains hidden
    await userEvent.click(screen.getByRole('button', { name: 'שמור' }));

    await waitFor(() => {
      const payload = onSubmit.mock.calls[0][0];
      expect(payload.qty).toBeNull();
      expect(payload.d).toBeNull();
      expect(payload.t).toBeNull();
      expect(payload.hiddenUnlessChecked).toBeUndefined(); // excluded because hidden
    });
  });
});


