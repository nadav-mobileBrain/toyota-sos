import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ImageUpload } from '@/components/driver/ImageUpload';

let attemptMap: Record<string, number> = {};

jest.mock('@/lib/auth', () => ({
  createBrowserClient: () => ({
    storage: {
      from: (bucket: string) => ({
        upload: jest.fn(async (path: string, _file: File, _opts: any) => {
          const n = (attemptMap[path] ?? 0) + 1;
          attemptMap[path] = n;
          // fail first two attempts, succeed on third
          if (n < 3) return { data: null, error: { message: 'transient' } };
          return { data: {}, error: null };
        }),
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

describe('ImageUpload retry logic (5.4.6)', () => {
  const origCreateObjectURL = URL.createObjectURL;
  beforeAll(() => {
    URL.createObjectURL = (f: any) => `preview://${f.name}-${f.size}`;
  });
  afterAll(() => {
    URL.createObjectURL = origCreateObjectURL;
  });
  beforeEach(() => {
    attemptMap = {};
  });

  test('retries failed uploads and eventually succeeds', async () => {
    const onUploaded = jest.fn();
    const { container } = render(
      <ImageUpload bucket="images" taskId="task-xyz" onUploaded={onUploaded} />
    );
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const f1 = createFile('retry.jpg', 'image/jpeg', 500);
    Object.defineProperty(input, 'files', { value: [f1], writable: false });
    fireEvent.change(input);

    const uploadBtn = screen.getByRole('button', { name: 'העלה' });
    await waitFor(() => expect(uploadBtn).not.toBeDisabled());
    fireEvent.click(uploadBtn);

    await waitFor(() => expect(onUploaded).toHaveBeenCalledTimes(1), { timeout: 10000 });
    // should have attempted path 3 times
    const metas = onUploaded.mock.calls[0][0];
    const path = metas[0].path;
    expect(attemptMap[path]).toBeGreaterThanOrEqual(3);
    expect(metas[0].signedUrl).toContain(encodeURIComponent(path));
  }, 12000);
});


