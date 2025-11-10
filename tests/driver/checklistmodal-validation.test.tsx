import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChecklistModal, ChecklistSchema } from '@/components/driver/ChecklistModal';

describe('ChecklistModal required validation', () => {
  const schema: ChecklistSchema = [
    { id: 'agree', type: 'boolean', title: 'אני מאשר', required: true },
    { id: 'name', type: 'string', title: 'שם מלא', required: true },
    { id: 'notes', type: 'textarea', title: 'הערות', required: false },
  ];

  test('blocks submit and shows inline errors until required fields are valid', async () => {
    const onSubmit = jest.fn();
    render(<ChecklistModal open onOpenChange={() => {}} schema={schema} onSubmit={onSubmit} />);

    // Try submit with required fields empty/false
    await userEvent.click(screen.getByRole('button', { name: 'שמור' }));
    expect(onSubmit).not.toHaveBeenCalled();
    // Inline errors should appear
    expect(await screen.findAllByText('שדה חובה')).toHaveLength(2);

    // Fix fields
    await userEvent.click(screen.getByRole('checkbox', { name: /אני מאשר/ }));
    await userEvent.type(screen.getByRole('textbox', { name: /שם מלא/ }), ' בדיקה');

    // Submit passes
    await userEvent.click(screen.getByRole('button', { name: 'שמור' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    const payload = onSubmit.mock.calls[0][0];
    expect(payload).toMatchObject({ agree: true, name: ' בדיקה' });
  });
});


