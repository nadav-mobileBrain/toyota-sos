import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ImageUpload } from '@/components/driver/ImageUpload';

let uploadResolve: (() => void) | null = null;
jest.mock('@/lib/auth', () => ({
  createBrowserClient: () => ({
    storage: {
      from: (_bucket: string) => ({
        upload: jest.fn(
          () =>
            new Promise((res) => {
              uploadResolve = () => res({ data: {}, error: null } as any);
            })
        ),
        createSignedUrl: jest.fn(async (path: string, _exp: number) => ({
          data: { signedUrl: `https://example.com/signed/${encodeURIComponent(path)}` },
          error: null,
        })),
      }),
    },
  }),
}));

function createFile(name: string, type: string, size = 1234) {
  const file = new File(['x'.repeat(size)], name, { type });
  Object.defineProperty(file, 'lastModified', { value: 1700000000000 });
  return file;
}

describe('ImageUpload A11y/RTL/mobile (5.4.7)', () => {
  const origCreateObjectURL = URL.createObjectURL;
  beforeAll(() => {
    URL.createObjectURL = (f: any) => `preview://${f.name}-${f.size}`;
  });
  afterAll(() => {
    URL.createObjectURL = origCreateObjectURL;
  });

  test('RTL dir, list roles, focus targets, and uploading aria-busy/live', async () => {
    const { container } = render(
      <ImageUpload bucket="images" taskId="task-rtl" label="בחר תמונות" />
    );
    const root = screen.getByTestId('image-upload');
    expect(root).toHaveAttribute('dir', 'rtl');

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const f1 = createFile('a.jpg', 'image/jpeg', 500);
    Object.defineProperty(input, 'files', { value: [f1], writable: false });
    fireEvent.change(input);

    // thumbnails list
    await waitFor(() => expect(screen.getByRole('list')).toBeInTheDocument());
    expect(screen.getAllByRole('listitem').length).toBeGreaterThanOrEqual(1);

    const uploadBtn = screen.getByRole('button', { name: 'העלה' });
    expect(uploadBtn).toHaveClass('min-h-[44px]');
    fireEvent.click(uploadBtn);

    // uploading state: button disabled and aria-busy, item shows polite live region
    await waitFor(() => expect(uploadBtn).toBeDisabled());
    expect(uploadBtn).toHaveAttribute('aria-busy', 'true');
    // Two places can show "מעלה..." (button label and item live region)
    expect(screen.getAllByText('מעלה...').length).toBeGreaterThanOrEqual(1);

    // finish upload
    uploadResolve?.();
    await waitFor(() => expect(uploadBtn).not.toBeDisabled());
    expect(screen.getByText('הועלה')).toBeInTheDocument();
  });
});


