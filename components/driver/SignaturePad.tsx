'use client';

import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

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
        />
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50 min-h-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-toyota-primary focus-visible:ring-offset-2"
            aria-label="נקה חתימה"
            disabled
          >
            נקה
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


