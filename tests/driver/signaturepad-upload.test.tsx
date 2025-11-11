import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { SignaturePad } from '@/components/driver/SignaturePad';

// Mock createBrowserClient to control storage calls
jest.mock('@/lib/auth', () => {
  return {
    createBrowserClient: () => ({
      storage: {
        from: (bucket: string) => ({
          upload: async (path: string, _body: Blob, _opts: any) => {
            (global as any).__lastUpload = { bucket, path };
            return { error: null };
          },
          createSignedUrl: async (path: string, _exp: number) => {
            (global as any).__lastSigned = { path };
            return { data: { signedUrl: `https://example.com/${encodeURIComponent(path)}` }, error: null };
          },
        }),
      },
    }),
  };
});

describe('SignaturePad upload (5.5.5)', () => {
  const origGetContext = HTMLCanvasElement.prototype.getContext;
  const origToBlob = HTMLCanvasElement.prototype.toBlob as any;
  const ctxMock = {
    fillStyle: '#fff',
    strokeStyle: '#000',
    lineWidth: 1,
    lineJoin: 'round',
    lineCap: 'round',
    fillRect: jest.fn(),
    clearRect: jest.fn(),
    beginPath: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    stroke: jest.fn(),
  };

  beforeAll(() => {
    // @ts-ignore
    HTMLCanvasElement.prototype.getContext = () => ctxMock;
    // Provide a simple randomUUID fallback for stable behavior
    if (!global.crypto) {
      // @ts-ignore
      global.crypto = {} as any;
    }
    if (!global.crypto.randomUUID) {
      // @ts-ignore
      global.crypto.randomUUID = () => '00000000-0000-0000-0000-000000000000';
    }
  });
  afterAll(() => {
    // @ts-ignore
    HTMLCanvasElement.prototype.getContext = origGetContext;
    // @ts-ignore
    HTMLCanvasElement.prototype.toBlob = origToBlob;
  });
  beforeEach(() => {
    jest.clearAllMocks();
    // @ts-ignore
    delete (global as any).__lastUpload;
    // @ts-ignore
    delete (global as any).__lastSigned;
  });

  test('uploads to Supabase with expected path and returns signed URL', async () => {
    const onUploaded = jest.fn();
    const { container } = render(
      <SignaturePad
        width={120}
        height={60}
        uploadBucket="signatures"
        taskId="TASK123"
        signedUrlExpiresInSeconds={600}
        onUploaded={onUploaded}
      />
    );
    const canvas = container.querySelector('canvas')!;

    // Draw a stroke so buttons enable
    fireEvent.pointerDown(canvas, { clientX: 10, clientY: 10 });
    fireEvent.pointerMove(canvas, { clientX: 50, clientY: 20 });
    fireEvent.pointerUp(canvas, { clientX: 50, clientY: 20 });

    // Mock toBlob to produce a PNG blob
    // @ts-ignore
    HTMLCanvasElement.prototype.toBlob = (cb: (b: Blob) => void) => {
      const bytes = new Uint8Array([137, 80, 78, 71, 1, 2, 3]);
      cb(new Blob([bytes], { type: 'image/png' }));
    };

    const saveBtn = screen.getByRole('button', { name: 'שמור חתימה' });
    expect(saveBtn).toBeEnabled();

    await act(async () => {
      fireEvent.click(saveBtn);
      await Promise.resolve();
    });

    const lastUpload = (global as any).__lastUpload;
    expect(lastUpload.bucket).toBe('signatures');
    // Path should be TASK123/YYYYMMDD/<uuid>-signature.png
    expect(lastUpload.path).toMatch(/^TASK123\/\d{8}\/.+-signature\.png$/);

    expect(onUploaded).toHaveBeenCalled();
    const meta = onUploaded.mock.calls[0][0];
    expect(meta.path).toEqual(lastUpload.path);
    expect(meta.signedUrl).toContain(encodeURIComponent(lastUpload.path));
    expect(meta.bytes).toBeGreaterThan(0);
  });
});


