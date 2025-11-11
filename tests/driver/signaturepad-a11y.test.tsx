import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { SignaturePad } from '@/components/driver/SignaturePad';

describe('SignaturePad a11y/RTL/keyboard (5.5.7)', () => {
  const origGetContext = HTMLCanvasElement.prototype.getContext;
  const ctxMock = {
    setTransform: jest.fn(),
    scale: jest.fn(),
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
    HTMLCanvasElement.prototype.getContext = () => ctxMock as any;
  });
  afterAll(() => {
    // @ts-ignore
    HTMLCanvasElement.prototype.getContext = origGetContext as any;
  });
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('has RTL container, canvas aria-label, and touch-action:none', () => {
    const { container } = render(<SignaturePad width={120} height={60} />);
    const root = screen.getByTestId('signature-pad');
    expect(root).toHaveAttribute('dir', 'rtl');
    const canvas = container.querySelector('canvas') as HTMLCanvasElement;
    expect(canvas).toBeInTheDocument();
    expect(canvas.getAttribute('aria-label')).toBe('לוח חתימה');
    expect((canvas.style as any).touchAction).toBe('none');
  });

  test('keyboard shortcuts: Meta/Ctrl+Z undo, Escape clears', () => {
    const onChange = jest.fn();
    const { container } = render(<SignaturePad width={100} height={50} onChange={onChange} />);
    const root = screen.getByTestId('signature-pad');
    const canvas = container.querySelector('canvas')!;

    // Create a stroke so hasSignature becomes true
    fireEvent.pointerDown(canvas, { clientX: 10, clientY: 10 });
    fireEvent.pointerMove(canvas, { clientX: 50, clientY: 20 });
    fireEvent.pointerUp(canvas, { clientX: 50, clientY: 20 });
    expect(onChange).toHaveBeenCalledWith(true);

    // Undo via Meta+Z (simulate macOS)
    fireEvent.keyDown(root, { key: 'z', metaKey: true });
    // onChange called with remaining signature state (likely false after one stroke)
    expect(onChange).toHaveBeenCalledWith(false);

    // Draw again and clear via Escape
    fireEvent.pointerDown(canvas, { clientX: 5, clientY: 5 });
    fireEvent.pointerMove(canvas, { clientX: 20, clientY: 10 });
    fireEvent.pointerUp(canvas, { clientX: 20, clientY: 10 });
    expect(onChange).toHaveBeenCalledWith(true);
    fireEvent.keyDown(root, { key: 'Escape' });
    expect(onChange).toHaveBeenCalledWith(false);
  });
});


