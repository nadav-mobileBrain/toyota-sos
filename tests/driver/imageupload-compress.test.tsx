import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ImageUpload } from '@/components/driver/ImageUpload';

describe('ImageUpload compression (5.4.3)', () => {
  const OrigImage = (global as any).Image;
  const origCreateObjectURL = URL.createObjectURL;
  const origToBlob = HTMLCanvasElement.prototype.toBlob;
  const origGetContext = HTMLCanvasElement.prototype.getContext;

  beforeAll(() => {
    // Mock Image to immediately "load"
    (global as any).Image = class {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      naturalWidth = 100;
      naturalHeight = 100;
      set src(_val: string) {
        setTimeout(() => this.onload && this.onload(), 0);
      }
    };
    // Mock createObjectURL
    URL.createObjectURL = () => 'blob:mock';
    // Mock toBlob to produce a smaller blob
    HTMLCanvasElement.prototype.toBlob = function (cb: (b: Blob | null) => void, _t?: string, q?: number) {
      const bytes = new Uint8Array(new Array(Math.max(1, Math.floor((q ?? 0.8) * 100))).fill(97));
      cb(new Blob([bytes], { type: 'image/jpeg' }));
    };
    // Mock getContext+drawImage
    // @ts-ignore
    HTMLCanvasElement.prototype.getContext = () => ({ drawImage: () => {} });
  });

  afterAll(() => {
    (global as any).Image = OrigImage;
    URL.createObjectURL = origCreateObjectURL;
    HTMLCanvasElement.prototype.toBlob = origToBlob;
    HTMLCanvasElement.prototype.getContext = origGetContext as any;
  });

  function createFile(name: string, type: string, size = 5000) {
    const file = new File(['x'.repeat(size)], name, { type });
    Object.defineProperty(file, 'lastModified', { value: 1700000000000 });
    return file;
  }

  test('compresses oversize image to be under maxSizeBytes and changes type to jpeg', async () => {
    const onChange = jest.fn();
    const { container } = render(<ImageUpload maxSizeBytes={2000} onChange={onChange} />);

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const bigPng = createFile('big.png', 'image/png', 5000);

    // Simulate picker change
    Object.defineProperty(input, 'files', {
      value: [bigPng],
      writable: false,
    });
    fireEvent.change(input);

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const payload = onChange.mock.calls[0][0];
    expect(payload).toHaveLength(1);
    const out = payload[0].file as File;
    expect(out.type).toBe('image/jpeg');
    expect(out.size).toBeLessThanOrEqual(2000);
  });
});


