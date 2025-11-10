'use client';

import React, { useMemo, useRef, useState } from 'react';

export type ImageUploadFile = {
  file: File;
  id: string; // stable id for rendering (e.g., `${name}-${size}-${lastModified}`)
  previewUrl?: string;
};

export type ImageUploadProps = {
  accept?: string; // e.g., "image/*"
  maxSizeBytes?: number; // e.g., 2_000_000
  multiple?: boolean;
  onChange?: (files: ImageUploadFile[]) => void;
  className?: string;
  label?: string; // accessible label for the picker button
};

/**
 * ImageUpload (5.4.1 scaffold)
 * - Renders a simple drop zone placeholder and a file picker button.
 * - Maintains internal list state and emits changes.
 * - Drag-and-drop, compression, thumbnails, uploads, retries will be added in later subtasks.
 */
export function ImageUpload(props: ImageUploadProps) {
  const {
    accept = 'image/*',
    maxSizeBytes,
    multiple = true,
    onChange,
    className,
    label = 'בחר תמונות',
  } = props;

  const inputRef = useRef<HTMLInputElement | null>(null);
  const [items, setItems] = useState<ImageUploadFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const createdUrlsRef = useRef<Set<string>>(new Set());

  const empty = items.length === 0;

  const handlePick = () => {
    inputRef.current?.click();
  };

  const fileAccepted = (f: File): boolean => {
    if (!accept) return true;
    // Minimal accept handling for image/* default
    if (accept === 'image/*') return f.type?.startsWith('image/');
    return true;
  };

  const mergeAndDeduplicate = (prev: ImageUploadFile[], next: ImageUploadFile[]): ImageUploadFile[] => {
    const map = new Map<string, ImageUploadFile>();
    for (const it of prev) map.set(it.id, it);
    for (const it of next) map.set(it.id, it);
    const merged = Array.from(map.values());
    return multiple ? merged : merged.slice(0, 1);
  };

  const handleFiles = async (filesList: FileList | File[] | null) => {
    if (!filesList) return;
    const files = Array.from(filesList as any) as File[];
    if (files.length === 0) return;
    const processed = await Promise.all(
      files.map(async (f) => {
        if (!fileAccepted(f)) return null;
        let out = f;
        if (maxSizeBytes && f.size > maxSizeBytes) {
          out = await compressIfNeeded(f, maxSizeBytes);
          if (out.size > maxSizeBytes) {
            // if still too big, drop for now (later subtasks will surface error)
            return null;
          }
        }
        const id = `${out.name}-${out.size}-${out.lastModified}`;
        let previewUrl: string | undefined = undefined;
        if (typeof window !== 'undefined' && typeof URL !== 'undefined' && URL.createObjectURL) {
          previewUrl = URL.createObjectURL(out);
          if (previewUrl) createdUrlsRef.current.add(previewUrl);
        }
        return { file: out, id, previewUrl } as ImageUploadFile;
      })
    );
    const next = processed.filter(Boolean) as ImageUploadFile[];
    setItems((prev) => {
      const merged = mergeAndDeduplicate(prev, next);
      // Revoke previews for removed items
      const mergedIds = new Set(merged.map((i) => i.id));
      for (const old of prev) {
        if (!mergedIds.has(old.id) && old.previewUrl) {
          try {
            URL.revokeObjectURL(old.previewUrl);
            createdUrlsRef.current.delete(old.previewUrl);
          } catch {}
        }
      }
      onChange?.(merged);
      return merged;
    });
  };

  const onDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };
  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const dt = e.dataTransfer;
    if (!dt) return;
    void handleFiles(dt.files);
  };

  return (
    <div className={className ?? ''} dir="rtl" data-testid="image-upload">
      <div
        className={`rounded-md border-2 border-dashed p-4 text-center text-sm ${
          isDragging ? 'border-toyota-primary bg-red-50 text-gray-800' : 'border-gray-300 text-gray-600'
        }`}
        aria-label="אזור העלאת תמונות"
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        {empty ? 'לא נבחרו תמונות' : `${items.length} קבצים נבחרו`}
      </div>

      <div className="mt-3">
        <button
          type="button"
          onClick={handlePick}
          className="rounded-md bg-toyota-primary px-3 py-2 text-sm text-white hover:bg-red-700 min-h-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-toyota-primary focus-visible:ring-offset-2"
          aria-label={label}
        >
          {label}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="sr-only"
          onChange={(e) => void handleFiles(e.currentTarget.files)}
          aria-hidden="true"
          tabIndex={-1}
        />
      </div>

      {items.length > 0 ? (
        <div className="mt-4 grid grid-cols-3 gap-3" role="list">
          {items.map((it) => (
            <figure key={it.id} className="rounded-md border p-2 bg-white" role="listitem">
              {it.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={it.previewUrl}
                  alt={it.file.name}
                  className="h-24 w-full object-cover rounded"
                />
              ) : (
                <div className="h-24 w-full rounded bg-gray-100" aria-label={it.file.name} />
              )}
              <figcaption className="mt-2 text-xs text-gray-700 truncate">{it.file.name}</figcaption>
              <button
                type="button"
                className="mt-2 w-full rounded-md border px-2 py-2 text-xs hover:bg-gray-50 min-h-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-toyota-primary focus-visible:ring-offset-2"
                aria-label={`הסר ${it.file.name}`}
                onClick={() => {
                  setItems((prev) => {
                    const next = prev.filter((p) => p.id !== it.id);
                    if (it.previewUrl) {
                      try {
                        URL.revokeObjectURL(it.previewUrl);
                        createdUrlsRef.current.delete(it.previewUrl);
                      } catch {}
                    }
                    onChange?.(next);
                    return next;
                  });
                }}
              >
                הסר
              </button>
            </figure>
          ))}
        </div>
      ) : null}
    </div>
  );
}

async function compressIfNeeded(file: File, maxSizeBytes: number): Promise<File> {
  try {
    if (typeof window === 'undefined') return file;
    // Load image
    const img = await loadImage(URL.createObjectURL(file));
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;

    // Keep dimensions initially; future: downscale if necessary
    canvas.width = img.naturalWidth || (img as any).width || 0;
    canvas.height = img.naturalHeight || (img as any).height || 0;
    if (canvas.width === 0 || canvas.height === 0) return file;

    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const attempt = (quality: number) =>
      new Promise<Blob | null>((resolve) => {
        (canvas as HTMLCanvasElement).toBlob(
          (blob) => resolve(blob),
          'image/jpeg',
          Math.min(Math.max(quality, 0.3), 0.92)
        );
      });

    // Heuristic quality based on ratio
    const ratio = maxSizeBytes / Math.max(1, file.size);
    const baseQ = Math.min(Math.max(ratio * 0.92, 0.3), 0.92);

    let blob = await attempt(baseQ);
    if (!blob) return file;
    if (blob.size > maxSizeBytes) {
      blob = await attempt(baseQ * 0.7);
      if (!blob) return file;
    }
    if (blob.size > maxSizeBytes) {
      blob = await attempt(baseQ * 0.5);
      if (!blob) return file;
    }
    if (blob.size >= file.size) {
      // no improvement
      return file;
    }
    const out = new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() });
    return out;
  } catch {
    return file;
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}


