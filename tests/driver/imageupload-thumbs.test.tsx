import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ImageUpload } from '@/components/driver/ImageUpload';

function createFile(name: string, type: string, size = 1234) {
  const file = new File(['x'.repeat(size)], name, { type });
  Object.defineProperty(file, 'lastModified', { value: 1700000000000 });
  return file;
}

describe('ImageUpload thumbnails and remove (5.4.4)', () => {
  const origCreateObjectURL = URL.createObjectURL;
  const origRevokeObjectURL = URL.revokeObjectURL;
  let revokeCalls = 0;

  beforeAll(() => {
    URL.createObjectURL = (f: any) => `preview://${f.name}-${f.size}`;
    URL.revokeObjectURL = () => {
      revokeCalls += 1;
    };
  });
  afterAll(() => {
    URL.createObjectURL = origCreateObjectURL;
    URL.revokeObjectURL = origRevokeObjectURL;
  });
  beforeEach(() => {
    revokeCalls = 0;
  });

  test('renders thumbnails and removes with revoke', async () => {
    const onChange = jest.fn();
    const { container } = render(<ImageUpload onChange={onChange} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    const f1 = createFile('pic1.png', 'image/png', 500);
    const f2 = createFile('pic2.jpg', 'image/jpeg', 600);
    Object.defineProperty(input, 'files', { value: [f1, f2], writable: false });
    fireEvent.change(input);

    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    // thumbnails
    expect(screen.getByAltText('pic1.png')).toBeInTheDocument();
    expect(screen.getByAltText('pic2.jpg')).toBeInTheDocument();

    // remove first
    const removeBtn = screen.getByRole('button', { name: /הסר pic1\.png/ });
    fireEvent.click(removeBtn);
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(2));
    expect(screen.queryByAltText('pic1.png')).not.toBeInTheDocument();
    expect(revokeCalls).toBeGreaterThanOrEqual(1);
  });
});


