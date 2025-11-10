import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ImageUpload } from '@/components/driver/ImageUpload';

function createFile(name: string, type: string, size = 1234) {
  const file = new File(['x'.repeat(size)], name, { type });
  Object.defineProperty(file, 'lastModified', { value: 1700000000000 });
  return file;
}

describe('ImageUpload validation (5.4.6)', () => {
  const origCreateObjectURL = URL.createObjectURL;
  const origToBlob = HTMLCanvasElement.prototype.toBlob;
  const origGetContext = HTMLCanvasElement.prototype.getContext;
  const OrigImage = (global as any).Image;
  beforeAll(() => {
    URL.createObjectURL = (f: any) => `preview://${f.name}-${f.size}`;
    // mock canvas to produce large blob (to exceed max after compression)
    // @ts-ignore
    HTMLCanvasElement.prototype.getContext = () => ({ drawImage: () => {} });
    HTMLCanvasElement.prototype.toBlob = function (cb: (b: Blob | null) => void) {
      const bytes = new Uint8Array(new Array(5000).fill(97)); // 5KB
      cb(new Blob([bytes], { type: 'image/jpeg' }));
    };
    // Mock Image to immediately load
    ;(global as any).Image = class {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      naturalWidth = 100;
      naturalHeight = 100;
      set src(_val: string) {
        setTimeout(() => this.onload && this.onload(), 0);
      }
    };
  });
  afterAll(() => {
    URL.createObjectURL = origCreateObjectURL;
    HTMLCanvasElement.prototype.toBlob = origToBlob;
    HTMLCanvasElement.prototype.getContext = origGetContext as any;
    (global as any).Image = OrigImage;
  });

  test('shows error for unsupported type and too-large file', async () => {
    const { container } = render(<ImageUpload maxSizeBytes={1000} />);
    const input = container.querySelector('input[type=\"file\"]') as HTMLInputElement;

    const badType = createFile('doc.txt', 'text/plain', 100);
    const tooBig = createFile('huge.png', 'image/png', 100000);
    Object.defineProperty(input, 'files', { value: [badType, tooBig], writable: false });
    fireEvent.change(input);
    await waitFor(() => expect(screen.getByRole('list')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('סוג קובץ לא נתמך')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('קובץ גדול מדי')).toBeInTheDocument());
  });
});


