import React from 'react';
import { render, screen } from '@testing-library/react';
import { SignaturePad } from '@/components/driver/SignaturePad';

describe('SignaturePad scaffold (5.5.1)', () => {
  test('renders canvas and disabled controls with RTL dir', () => {
    const { container } = render(<SignaturePad width={320} height={160} />);
    const root = screen.getByTestId('signature-pad');
    expect(root).toHaveAttribute('dir', 'rtl');

    const canvas = container.querySelector('canvas');
    expect(canvas).toBeInTheDocument();
    expect(canvas?.getAttribute('width')).toBe('320');
    expect(canvas?.getAttribute('height')).toBe('160');

    const clearBtn = screen.getByRole('button', { name: 'נקה חתימה' });
    const exportBtn = screen.getByRole('button', { name: 'ייצא חתימה' });
    expect(clearBtn).toBeDisabled();
    expect(exportBtn).toBeDisabled();
  });
});


