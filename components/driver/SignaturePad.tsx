'use client';

import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

export type SignaturePadProps = {
  width?: number;
  height?: number;
  lineWidth?: number;
  lineColor?: string;
  backgroundColor?: string;
  className?: string;
  onChange?: (hasSignature: boolean) => void;
};

export type SignaturePadRef = {
  clear: () => void;
  exportBlob: () => Promise<Blob | null>;
};

/**
 * SignaturePad (5.5.1 scaffold)
 * - Renders a canvas with configurable dimensions and basic controls area.
 * - No drawing implemented yet (added in later subtasks).
 * - Exposes clear/export methods via ref (no-op for now).
 */
export const SignaturePad = forwardRef<SignaturePadRef, SignaturePadProps>(function SignaturePad(
  props,
  ref
) {
  const {
    width = 300,
    height = 150,
    lineWidth = 3,
    lineColor = '#000000',
    backgroundColor = '#ffffff',
    className,
    onChange,
  } = props;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef<boolean>(false);
  const lastXRef = useRef<number>(0);
  const lastYRef = useRef<number>(0);
  const strokesRef = useRef<Array<Array<{ x: number; y: number }>>>([]);
  const hasSignatureRef = useRef<boolean>(false);
  const [hasSignature, setHasSignature] = useState<boolean>(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // Fill background for visual clarity
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, [backgroundColor, width, height]);

  useImperativeHandle(
    ref,
    () => ({
      clear: () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        strokesRef.current = [];
        hasSignatureRef.current = false;
        setHasSignature(false);
        onChange?.(false);
      },
      exportBlob: async () => {
        const canvas = canvasRef.current;
        if (!canvas) return null;
        return await new Promise<Blob | null>((resolve) => {
          if (canvas.toBlob) {
            canvas.toBlob((b) => resolve(b), 'image/png', 0.92);
          } else {
            try {
              const dataUrl = canvas.toDataURL('image/png');
              const bin = atob(dataUrl.split(',')[1] || '');
              const bytes = new Uint8Array(bin.length);
              for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
              resolve(new Blob([bytes], { type: 'image/png' }));
            } catch {
              resolve(null);
            }
          }
        });
      },
    }),
    [backgroundColor, onChange]
  );

  const getCanvasPoint = (e: PointerEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    return { x, y };
  };

  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture?.(e.pointerId);
    if (e.pointerType === 'touch') {
      // prevent scrolling while drawing
      e.preventDefault();
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = lineColor;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const p = getCanvasPoint(e.nativeEvent, canvas);
    isDrawingRef.current = true;
    lastXRef.current = p.x;
    lastYRef.current = p.y;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    // start a new stroke
    strokesRef.current.push([{ x: p.x, y: p.y }]);
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (e.pointerType === 'touch') e.preventDefault();
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { x, y } = getCanvasPoint(e.nativeEvent, canvas);
    // simple smoothing by interpolating points
    const lastX = lastXRef.current;
    const lastY = lastYRef.current;
    const dx = x - lastX;
    const dy = y - lastY;
    const dist = Math.hypot(dx, dy);
    const steps = Math.max(1, Math.floor(dist / 2));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const ix = lastX + dx * t;
      const iy = lastY + dy * t;
      ctx.lineTo(ix, iy);
      const currentStroke = strokesRef.current[strokesRef.current.length - 1];
      if (currentStroke) currentStroke.push({ x: ix, y: iy });
    }
    ctx.stroke();
    lastXRef.current = x;
    lastYRef.current = y;
  };

  const endDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (e.pointerType === 'touch') e.preventDefault();
    isDrawingRef.current = false;
    hasSignatureRef.current = strokesRef.current.length > 0;
    setHasSignature(hasSignatureRef.current);
    onChange?.(hasSignatureRef.current);
  };

  const redrawAll = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = lineColor;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    for (const stroke of strokesRef.current) {
      if (stroke.length === 0) continue;
      ctx.beginPath();
      ctx.moveTo(stroke[0].x, stroke[0].y);
      for (let i = 1; i < stroke.length; i++) {
        ctx.lineTo(stroke[i].x, stroke[i].y);
      }
      ctx.stroke();
    }
  };

  return (
    <div className={className ?? ''} dir="rtl" data-testid="signature-pad">
      <div className="rounded-md border p-2 bg-white">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          // Ensure visible size matches intrinsic size for crispness at 1x; DPI scaling added later
          style={{ width: `${width}px`, height: `${height}px`, backgroundColor }}
          aria-label="לוח חתימה"
          onPointerDown={startDrawing}
          onPointerMove={draw}
          onPointerUp={endDrawing}
          onPointerCancel={endDrawing}
        />
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50 min-h-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-toyota-primary focus-visible:ring-offset-2"
            aria-label="נקה חתימה"
            disabled={!hasSignature}
            onClick={() => {
              const canvas = canvasRef.current;
              if (!canvas) return;
              const ctx = canvas.getContext('2d');
              if (!ctx) return;
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              ctx.fillStyle = backgroundColor;
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              strokesRef.current = [];
              hasSignatureRef.current = false;
              setHasSignature(false);
              // Ensure we signal cleared state synchronously then force a microtask to flush updates
              onChange?.(false);
            }}
          >
            נקה
          </button>
          <button
            type="button"
            className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50 min-h-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-toyota-primary focus-visible:ring-offset-2"
            aria-label="בטל פעולה אחרונה"
            disabled={!hasSignature}
            onClick={() => {
              if (strokesRef.current.length === 0) return;
              strokesRef.current.pop();
              hasSignatureRef.current = strokesRef.current.length > 0;
              redrawAll();
              setHasSignature(hasSignatureRef.current);
              onChange?.(hasSignatureRef.current);
            }}
          >
            בטל
          </button>
          <button
            type="button"
            className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50 min-h-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-toyota-primary focus-visible:ring-offset-2"
            aria-label="ייצא חתימה"
            disabled
          >
            ייצא
          </button>
        </div>
      </div>
    </div>
  );
});


