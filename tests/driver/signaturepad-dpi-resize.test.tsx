import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { SignaturePad } from '@/components/driver/SignaturePad';

describe('SignaturePad high-DPI and resize (5.5.6)', () => {
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
    // force a known DPR
    Object.defineProperty(window, 'devicePixelRatio', {
      value: 2,
      writable: true,
      configurable: true,
    });
  });

  test('sets intrinsic canvas size by devicePixelRatio and redraws on resize', () => {
    const { container } = render(<SignaturePad width={150} height={80} />);
    const canvas = container.querySelector('canvas') as HTMLCanvasElement;
    expect(canvas).toBeInTheDocument();
    // Intrinsic size should be scaled by DPR
    expect(canvas.width).toBe(150 * 2);
    expect(canvas.height).toBe(80 * 2);
    // setTransform + scale called during setup
    expect(ctxMock.setTransform).toHaveBeenCalled();
    expect(ctxMock.scale).toHaveBeenCalledWith(2, 2);
    // background filled
    expect(ctxMock.fillRect).toHaveBeenCalled();

    // Draw a quick stroke
    fireEvent.pointerDown(canvas, { clientX: 10, clientY: 10 });
    fireEvent.pointerMove(canvas, { clientX: 50, clientY: 20 });
    fireEvent.pointerUp(canvas, { clientX: 50, clientY: 20 });
    const callsBefore = ctxMock.stroke.mock.calls.length;

    // Simulate resize: change DPR and dispatch event
    // @ts-ignore
    window.devicePixelRatio = 3;
    window.dispatchEvent(new Event('resize'));

    // Should have re-setup canvas and redrawn strokes
    expect(ctxMock.setTransform).toHaveBeenCalled();
    expect(ctxMock.scale).toHaveBeenCalledWith(3, 3);
    expect(canvas.width).toBe(150 * 3);
    expect(canvas.height).toBe(80 * 3);
    expect(ctxMock.clearRect).toHaveBeenCalled(); // clear before redraw
    expect(ctxMock.stroke.mock.calls.length).toBeGreaterThan(callsBefore); // additional strokes from redraw
  });
});


