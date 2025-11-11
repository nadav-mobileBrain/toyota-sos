import React from 'react';
import { render } from '@testing-library/react';
import { SignaturePad } from '@/components/driver/SignaturePad';

describe('SignaturePad resize coalescing (5.6.4)', () => {
  const origGetContext = HTMLCanvasElement.prototype.getContext;
  const ctxMock = {
    setTransform: jest.fn(),
    resetTransform: jest.fn(),
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
    jest.useFakeTimers();
  });
  afterAll(() => {
    // @ts-ignore
    HTMLCanvasElement.prototype.getContext = origGetContext as any;
    jest.useRealTimers();
  });
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('multiple resize events result in a single redraw (debounced)', () => {
    const { container } = render(<SignaturePad width={200} height={100} />);
    const canvas = container.querySelector('canvas') as HTMLCanvasElement;
    expect(canvas).toBeInTheDocument();

    const before = ctxMock.clearRect.mock.calls.length;
    // Dispatch many resize events quickly
    for (let i = 0; i < 10; i++) {
      window.dispatchEvent(new Event('resize'));
    }
    // No redraw yet until timer fires
    expect(ctxMock.clearRect.mock.calls.length).toBe(before);
    // Advance timers to trigger debounced redraw
    jest.runAllTimers();
    const after = ctxMock.clearRect.mock.calls.length;
    expect(after - before).toBe(1);
  });
});


