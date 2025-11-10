import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { SignaturePad } from '@/components/driver/SignaturePad';

describe('SignaturePad clear and undo (5.5.3)', () => {
  const origGetContext = HTMLCanvasElement.prototype.getContext;
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
    HTMLCanvasElement.prototype.getContext = origGetContext as any;
  });
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('clear resets canvas and calls onChange(false)', () => {
    const onChange = jest.fn();
    const { container } = render(<SignaturePad onChange={onChange} />);
    const canvas = container.querySelector('canvas')!;
    // draw
    fireEvent.pointerDown(canvas, { clientX: 5, clientY: 5 });
    fireEvent.pointerMove(canvas, { clientX: 10, clientY: 10 });
    fireEvent.pointerUp(canvas, { clientX: 10, clientY: 10 });

    // click clear
    const clearBtn = screen.getByRole('button', { name: 'נקה חתימה' });
    fireEvent.click(clearBtn);
    // onChange should be called with false at least once
    expect(onChange).toHaveBeenCalledWith(false);
    // clearRect was used
    expect(ctxMock.clearRect).toHaveBeenCalled();
  });

  test('undo removes last stroke and updates onChange accordingly', () => {
    const onChange = jest.fn();
    const { container } = render(<SignaturePad onChange={onChange} />);
    const canvas = container.querySelector('canvas')!;
    // first stroke
    fireEvent.pointerDown(canvas, { clientX: 5, clientY: 5 });
    fireEvent.pointerMove(canvas, { clientX: 10, clientY: 10 });
    fireEvent.pointerUp(canvas, { clientX: 10, clientY: 10 });
    // second stroke
    fireEvent.pointerDown(canvas, { clientX: 20, clientY: 20 });
    fireEvent.pointerMove(canvas, { clientX: 25, clientY: 25 });
    fireEvent.pointerUp(canvas, { clientX: 25, clientY: 25 });

    const undoBtn = screen.getByRole('button', { name: 'בטל פעולה אחרונה' });
    fireEvent.click(undoBtn);
    // Still has at least one stroke; onChange called with true at some point
    expect(onChange).toHaveBeenCalledWith(true);

    // Undo again -> none; should call onChange(false)
    fireEvent.click(undoBtn);
    expect(onChange).toHaveBeenCalledWith(false);
  });
});


