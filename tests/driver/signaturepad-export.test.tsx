import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { SignaturePad } from '@/components/driver/SignaturePad';

describe('SignaturePad export (5.5.4)', () => {
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
  });
  afterAll(() => {
    // @ts-ignore
    HTMLCanvasElement.prototype.getContext = origGetContext;
    // @ts-ignore
    HTMLCanvasElement.prototype.toBlob = origToBlob;
  });
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('exports PNG blob with metadata after drawing', async () => {
    const onExport = jest.fn();
    const { container } = render(<SignaturePad width={120} height={60} onExport={onExport} />);
    const canvas = container.querySelector('canvas')!;

    // Simulate a simple stroke
    fireEvent.pointerDown(canvas, { clientX: 10, clientY: 10 });
    fireEvent.pointerMove(canvas, { clientX: 50, clientY: 20 });
    fireEvent.pointerUp(canvas, { clientX: 50, clientY: 20 });

    // Mock toBlob to produce a small PNG-like blob
    // @ts-ignore
    HTMLCanvasElement.prototype.toBlob = (cb: (b: Blob) => void, _type?: string, _q?: number) => {
      const bytes = new Uint8Array([137, 80, 78, 71, 1, 2, 3]); // not a real PNG, but fine for type/size checks
      cb(new Blob([bytes], { type: 'image/png' }));
    };

    const exportBtn = screen.getByRole('button', { name: 'ייצא חתימה' });
    expect(exportBtn).toBeEnabled();

    await act(async () => {
      fireEvent.click(exportBtn);
      // allow any microtasks to flush
      await Promise.resolve();
    });

    expect(onExport).toHaveBeenCalled();
    const payload = onExport.mock.calls[0][0];
    expect(payload.blob).toBeInstanceOf(Blob);
    expect(payload.blob.type).toBe('image/png');
    expect(payload.bytes).toBeGreaterThan(0);
    expect(payload.width).toBe(120);
    expect(payload.height).toBe(60);
    // dataURL may be empty in jsdom; do not assert non-empty
  });
});


