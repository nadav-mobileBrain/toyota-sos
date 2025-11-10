import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImageUpload } from '@/components/driver/ImageUpload';

describe('ImageUpload scaffold (5.4.1)', () => {
  test('renders empty state and accessible controls', async () => {
    render(<ImageUpload />);

    // Container and empty message
    expect(screen.getByTestId('image-upload')).toBeInTheDocument();
    expect(screen.getByLabelText('אזור העלאת תמונות')).toBeInTheDocument();
    expect(screen.getByText('לא נבחרו תמונות')).toBeInTheDocument();

    // Picker button
    const pickBtn = screen.getByRole('button', { name: 'בחר תמונות' });
    expect(pickBtn).toBeInTheDocument();
    expect(pickBtn).toHaveClass('min-h-[44px]');
  });
});


