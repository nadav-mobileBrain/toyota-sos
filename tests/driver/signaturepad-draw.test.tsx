import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { SignaturePad } from '@/components/driver/SignaturePad';

describe('SignaturePad drawing (5.5.2)', () => {
  const origGetContext = HTMLCanvasElement.prototype.getContext;
  beforeAll(() => {
    // Mock 2d context methods used by the component
    // @ts-ignore
    HTMLCanvasElement.prototype.getContext = () => ({
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
    });
  });
  afterAll(() => {
    HTMLCanvasElement.prototype.getContext = origGetContext as any;
  });

  test('pointer events trigger drawing and onChange(true)', () => {
    const onChange = jest.fn();
    const { container } = render(<SignaturePad width={100} height={50} onChange={onChange} />);
    const canvas = container.querySelector('canvas')!;

    // Simulate a simple stroke
    fireEvent.pointerDown(canvas, { clientX: 10, clientY: 10 });
    fireEvent.pointerMove(canvas, { clientX: 50, clientY: 20 });
    fireEvent.pointerUp(canvas, { clientX: 50, clientY: 20 });

    // onChange should be called with true at least once when drawing ends
    expect(onChange).toHaveBeenCalledWith(true);
  });
});


