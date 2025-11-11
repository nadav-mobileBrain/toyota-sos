'use client';

import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { createBrowserClient } from '@/lib/auth';

export type SignaturePadProps = {
  width?: number;
  height?: number;
  lineWidth?: number;
  lineColor?: string;
  backgroundColor?: string;
  className?: string;
  onChange?: (hasSignature: boolean) => void;
  onExport?: (result: {
    blob: Blob;
    dataURL: string;
    width: number;
    height: number;
    bytes: number;
  }) => void;
  uploadBucket?: string; // Supabase Storage bucket for signatures
  taskId?: string; // used for path convention
  signedUrlExpiresInSeconds?: number; // default 3600
  onUploaded?: (meta: { path: string; signedUrl?: string | null; bytes: number }) => void;
};

export type SignaturePadRef = {
  clear: () => void;
  exportBlob: () => Promise<Blob | null>;
  exportSignature: () => Promise<{
    blob: Blob;
    dataURL: string;
    width: number;
    height: number;
    bytes: number;
  } | null>;
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
    onExport,
    uploadBucket,
    taskId,
    signedUrlExpiresInSeconds,
    onUploaded,
  } = props;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef<boolean>(false);
  const lastXRef = useRef<number>(0);
  const lastYRef = useRef<number>(0);
  const strokesRef = useRef<Array<Array<{ x: number; y: number }>>>([]);
  const hasSignatureRef = useRef<boolean>(false);
  const [hasSignature, setHasSignature] = useState<boolean>(false);
  const dprRef = useRef<number>(1);
  const resizeDebounceRef = useRef<any>(null);

  const setupCanvasForDPR = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = typeof window !== 'undefined' && window.devicePixelRatio ? window.devicePixelRatio : 1;
    dprRef.current = dpr;
    // Set intrinsic size in device pixels
    canvas.width = Math.max(1, Math.floor(width * dpr));
    canvas.height = Math.max(1, Math.floor(height * dpr));
    // Maintain visual (CSS) size
    (canvas.style as any).width = `${width}px`;
    (canvas.style as any).height = `${height}px`;
    // Reset transform then scale so 1 unit == 1 CSS pixel
    const anyCtx = ctx as any;
    if (typeof anyCtx.setTransform === 'function') {
      anyCtx.setTransform(1, 0, 0, 1, 0, 0);
    } else if (typeof anyCtx.resetTransform === 'function') {
      anyCtx.resetTransform();
    }
    if (typeof ctx.scale === 'function') {
      ctx.scale(dpr, dpr);
    }
    // Fill background using CSS pixel space
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);
  };

  useEffect(() => {
    setupCanvasForDPR();
    // Redraw any existing strokes after re-scaling
    redrawAll();
    // Listen for window resize (viewport or DPR changes)
    const onResize = () => {
      const nextDpr =
        typeof window !== 'undefined' && window.devicePixelRatio ? window.devicePixelRatio : 1;
      const prevDpr = dprRef.current;
      if (nextDpr !== prevDpr) {
        // DPI changed: reconfigure and redraw immediately (crispness matters)
        setupCanvasForDPR();
        redrawAll();
        return;
      }
      // No DPI change: update sizing/transform immediately, but coalesce redraws
      setupCanvasForDPR();
      if (resizeDebounceRef.current != null) return;
      resizeDebounceRef.current = setTimeout(() => {
        resizeDebounceRef.current = null;
        redrawAll();
      }, 16);
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', onResize);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', onResize);
      }
      if (resizeDebounceRef.current != null) {
        clearTimeout(resizeDebounceRef.current);
        resizeDebounceRef.current = null;
      }
    };
  }, [backgroundColor, width, height]);

  useImperativeHandle(
    ref,
    () => ({
      clear: () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        // Clear in CSS coordinates; transform maps to device pixels
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, width, height);
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
      exportSignature: async () => {
        const canvas = canvasRef.current;
        if (!canvas) return null;
        const width = canvas.width;
        const height = canvas.height;
        const blob = await new Promise<Blob | null>((resolve) => {
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
        if (!blob) return null;
        let dataURL = '';
        try {
          dataURL = canvas.toDataURL('image/png');
        } catch {
          dataURL = '';
        }
        const bytes = typeof blob.size === 'number' ? blob.size : 0;
        return { blob, dataURL, width, height, bytes };
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
    // Clear and repaint background in CSS pixels
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);
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

  const yyyymmdd = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}${m}${day}`;
  };

  return (
    <div
      className={className ?? ''}
      dir="rtl"
      data-testid="signature-pad"
      onKeyDown={(e) => {
        // Keyboard shortcuts:
        // - Meta/Ctrl + Z: undo last stroke
        // - Escape/Delete/Backspace: clear canvas
        const isUndo = (e.key === 'z' || e.key === 'Z') && (e.metaKey || e.ctrlKey);
        const isClear = e.key === 'Escape' || e.key === 'Delete' || e.key === 'Backspace';
        if (isUndo) {
          e.preventDefault();
          if (strokesRef.current.length === 0) return;
          strokesRef.current.pop();
          hasSignatureRef.current = strokesRef.current.length > 0;
          redrawAll();
          setHasSignature(hasSignatureRef.current);
          onChange?.(hasSignatureRef.current);
          return;
        }
        if (isClear) {
          e.preventDefault();
          const canvas = canvasRef.current;
          if (!canvas) return;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;
          ctx.clearRect(0, 0, width, height);
          ctx.fillStyle = backgroundColor;
          ctx.fillRect(0, 0, width, height);
          strokesRef.current = [];
          hasSignatureRef.current = false;
          setHasSignature(false);
          onChange?.(false);
        }
      }}
      tabIndex={-1}
    >
      <div className="rounded-md border p-2 bg-white">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          // Ensure visible size matches intrinsic size for crispness at 1x; DPI scaling added later
          style={{ width: `${width}px`, height: `${height}px`, backgroundColor, touchAction: 'none' }}
          aria-label="לוח חתימה"
          tabIndex={0}
          onPointerDown={startDrawing}
          onPointerMove={draw}
          onPointerUp={endDrawing}
          onPointerCancel={endDrawing}
          onKeyDown={(e) => {
            // Delegate to parent handler for shortcuts
            (e.currentTarget.parentElement as HTMLElement | null)?.dispatchEvent(
              new KeyboardEvent('keydown', {
                key: e.key,
                code: (e as any).code,
                ctrlKey: e.ctrlKey,
                metaKey: e.metaKey,
                bubbles: true,
                cancelable: true,
              })
            );
          }}
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
            disabled={!hasSignature}
            onClick={async () => {
              const canvas = canvasRef.current;
              if (!canvas) return;
              const width = canvas.width;
              const height = canvas.height;
              const blob = await new Promise<Blob | null>((resolve) => {
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
              if (!blob) return;
              let dataURL = '';
              try {
                dataURL = canvas.toDataURL('image/png');
              } catch {
                dataURL = '';
              }
              const bytes = typeof blob.size === 'number' ? blob.size : 0;
              const result = { blob, dataURL, width, height, bytes };
              if (result && onExport) onExport(result);
            }}
          >
            ייצא
          </button>
          {uploadBucket && taskId ? (
            <button
              type="button"
              className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50 min-h-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-toyota-primary focus-visible:ring-offset-2"
              aria-label="שמור חתימה"
              disabled={!hasSignature}
              onClick={async () => {
                const canvas = canvasRef.current;
                if (!canvas) return;
                // export
                const blob = await new Promise<Blob | null>((resolve) => {
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
                if (!blob) return;
                // upload
                const supa = createBrowserClient();
                const folder = `${taskId}/${yyyymmdd(new Date())}`;
                const uuid = (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));
                const path = `${folder}/${uuid}-signature.png`;
                const { error: upErr } = await supa.storage.from(uploadBucket).upload(path, blob, {
                  contentType: 'image/png',
                  upsert: true,
                });
                if (upErr) return;
                // sign
                const expiresIn = signedUrlExpiresInSeconds ?? 3600;
                const { data: signed, error: signErr } = await supa.storage.from(uploadBucket).createSignedUrl(path, expiresIn);
                if (!signErr) {
                  onUploaded?.({ path, signedUrl: signed?.signedUrl ?? null, bytes: blob.size });
                } else {
                  onUploaded?.({ path, signedUrl: null, bytes: blob.size });
                }
              }}
            >
              שמור
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
});


