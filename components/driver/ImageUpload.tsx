'use client';

import React, { useMemo, useRef, useState } from 'react';
import { createBrowserClient } from '@/lib/auth';

export type ImageUploadFile = {
  file: File;
  id: string; // stable id for rendering (e.g., `${name}-${size}-${lastModified}`)
  previewUrl?: string;
  status?: 'ready' | 'uploading' | 'uploaded' | 'error';
  error?: string | null;
  retryCount?: number;
};

export type ImageUploadProps = {
  accept?: string; // e.g., "image/*"
  maxSizeBytes?: number; // e.g., 2_000_000
  multiple?: boolean;
  onChange?: (files: ImageUploadFile[]) => void;
  onUploaded?: (files: UploadedImageMeta[]) => void;
  className?: string;
  label?: string; // accessible label for the picker button
  bucket?: string; // Supabase storage bucket
  taskId?: string; // used for path convention
  pathPrefix?: string; // override default path (default is taskId/yyyymmdd)
  signedUrlExpiresInSeconds?: number; // default 3600
  capture?: 'user' | 'environment'; // camera capture mode
};

export type UploadedImageMeta = {
  path: string;
  signedUrl?: string | null;
  name: string;
  size: number;
  contentType: string;
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
    capture,
  } = props;

  const inputRef = useRef<HTMLInputElement | null>(null);
  const [items, setItems] = useState<ImageUploadFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const createdUrlsRef = useRef<Set<string>>(new Set());
  const [uploading, setUploading] = useState(false);

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

  const mergeAndDeduplicate = (
    prev: ImageUploadFile[],
    next: ImageUploadFile[]
  ): ImageUploadFile[] => {
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
        if (!fileAccepted(f)) {
          const id = `${f.name}-${f.size}-${f.lastModified}`;
          return {
            file: f,
            id,
            status: 'error',
            error: 'סוג קובץ לא נתמך',
            retryCount: 0,
          } as ImageUploadFile;
        }
        let out = f;
        if (maxSizeBytes && f.size > maxSizeBytes) {
          out = await compressIfNeeded(f, maxSizeBytes);
          if (out.size > maxSizeBytes) {
            const id = `${f.name}-${f.size}-${f.lastModified}`;
            return {
              file: f,
              id,
              status: 'error',
              error: 'קובץ גדול מדי',
              retryCount: 0,
            } as ImageUploadFile;
          }
        }
        const id = `${out.name}-${out.size}-${out.lastModified}`;
        let previewUrl: string | undefined = undefined;
        if (
          typeof window !== 'undefined' &&
          typeof URL !== 'undefined' &&
          URL.createObjectURL
        ) {
          previewUrl = URL.createObjectURL(out);
          if (previewUrl) createdUrlsRef.current.add(previewUrl);
        }
        return {
          file: out,
          id,
          previewUrl,
          status: 'ready',
          error: null,
          retryCount: 0,
        } as ImageUploadFile;
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

  const sanitizeName = (name: string) => name.replace(/[^a-zA-Z0-9._-]+/g, '_');
  const yyyymmdd = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}${m}${day}`;
  };

  const getUploadPath = () => {
    if (props.pathPrefix) {
      return props.pathPrefix.replace(/\/$/, ''); // remove trailing slash
    }
    return `${props.taskId}/${yyyymmdd(new Date())}`;
  };

  const handleUpload = async () => {
    if (!props.bucket || !props.taskId) return;
    if (items.length === 0) return;
    setUploading(true);
    try {
      const supa = createBrowserClient();
      const folder = getUploadPath();
      const metas: UploadedImageMeta[] = [];
      for (const it of items) {
        if (it.status === 'uploaded') continue;
        // attempt retries for each item
        setItems((prev) =>
          prev.map((p) =>
            p.id === it.id ? { ...p, status: 'uploading', error: null } : p
          )
        );
        const uuid =
          globalThis.crypto?.randomUUID?.() ??
          Math.random().toString(36).slice(2);
        const fileName = `${uuid}-${sanitizeName(it.file.name)}`;
        const path = `${folder}/${fileName}`;
        const uploaded = await uploadWithRetries(
          supa,
          props.bucket,
          path,
          it.file,
          3
        );
        if (!uploaded) {
          setItems((prev) =>
            prev.map((p) =>
              p.id === it.id
                ? {
                    ...p,
                    status: 'error',
                    error: 'שגיאת העלאה, נסה שוב',
                    retryCount: (p.retryCount ?? 0) + 1,
                  }
                : p
            )
          );
          continue;
        }
        setItems((prev) =>
          prev.map((p) =>
            p.id === it.id ? { ...p, status: 'uploaded', error: null } : p
          )
        );
        let signedUrl: string | null | undefined = undefined;
        const expiresIn = props.signedUrlExpiresInSeconds ?? 3600;
        const { data: signed, error: signErr } = await supa.storage
          .from(props.bucket)
          .createSignedUrl(path, expiresIn);
        if (!signErr) {
          signedUrl = signed?.signedUrl ?? null;
        }
        metas.push({
          path,
          signedUrl: signedUrl ?? null,
          name: it.file.name,
          size: it.file.size,
          contentType: it.file.type || 'application/octet-stream',
        });
      }
      if (metas.length > 0) {
        props.onUploaded?.(metas);
      }
    } finally {
      setUploading(false);
    }
  };
  const retrySingle = async (it: ImageUploadFile) => {
    if (!props.bucket || !props.taskId) return;
    const supa = createBrowserClient();
    const folder = getUploadPath();
    setItems((prev) =>
      prev.map((p) =>
        p.id === it.id ? { ...p, status: 'uploading', error: null } : p
      )
    );
    const uuid =
      globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
    const fileName = `${uuid}-${sanitizeName(it.file.name)}`;
    const path = `${folder}/${fileName}`;
    const uploaded = await uploadWithRetries(
      supa,
      props.bucket,
      path,
      it.file,
      3
    );
    if (!uploaded) {
      setItems((prev) =>
        prev.map((p) =>
          p.id === it.id
            ? {
                ...p,
                status: 'error',
                error: 'שגיאת העלאה, נסה שוב',
                retryCount: (p.retryCount ?? 0) + 1,
              }
            : p
        )
      );
      return;
    }
    setItems((prev) =>
      prev.map((p) =>
        p.id === it.id ? { ...p, status: 'uploaded', error: null } : p
      )
    );
  };

  async function uploadWithRetries(
    supa: any,
    bucket: string,
    path: string,
    file: File,
    maxAttempts: number
  ): Promise<boolean> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const { error: upErr } = await supa.storage
        .from(bucket)
        .upload(path, file, {
          contentType: file.type || 'application/octet-stream',
          upsert: true,
        });
      if (!upErr) return true;
      // backoff: 200ms * attempt
      await new Promise((r) => setTimeout(r, 200 * attempt));
    }
    return false;
  }

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
          isDragging
            ? 'border-primary bg-red-50 text-gray-800'
            : 'border-gray-300 text-gray-600'
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
          className="rounded-md bg-primary px-3 py-2 text-sm text-white hover:bg-red-700 min-h-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          aria-label={label}
        >
          {label}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          capture={capture}
          className="sr-only"
          onChange={(e) => void handleFiles(e.currentTarget.files)}
          aria-hidden="true"
          tabIndex={-1}
        />
      </div>

      {items.length > 0 ? (
        <div className="mt-4 grid grid-cols-3 gap-3" role="list">
          {items.map((it) => (
            <figure
              key={it.id}
              className="rounded-md border p-2 bg-white"
              role="listitem"
            >
              {it.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={it.previewUrl}
                  alt={it.file.name}
                  className="h-24 w-full object-cover rounded"
                />
              ) : (
                <div
                  className="h-24 w-full rounded bg-gray-100"
                  aria-label={it.file.name}
                />
              )}
              <figcaption className="mt-2 text-xs text-gray-700 truncate">
                {it.file.name}
              </figcaption>
              <div className="mt-1 text-[11px]">
                {it.status === 'uploading' ? (
                  <span aria-live="polite">מעלה...</span>
                ) : null}
                {it.status === 'uploaded' ? (
                  <span className="text-green-600">הועלה</span>
                ) : null}
                {it.status === 'error' ? (
                  <span className="text-red-600" role="alert">
                    {it.error}
                  </span>
                ) : null}
              </div>
              <button
                type="button"
                className="mt-2 w-full rounded-md border px-2 py-2 text-xs hover:bg-gray-50 min-h-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
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
              {it.status === 'error' ? (
                <button
                  type="button"
                  className="mt-1 w-full rounded-md border px-2 py-2 text-xs hover:bg-gray-50 min-h-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  aria-label={`נסה שוב ${it.file.name}`}
                  onClick={() => void retrySingle(it)}
                >
                  נסה שוב
                </button>
              ) : null}
            </figure>
          ))}
        </div>
      ) : null}
      {props.bucket && props.taskId ? (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => void handleUpload()}
            disabled={uploading || items.length === 0}
            className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50 min-h-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-50"
            aria-busy={uploading ? 'true' : undefined}
          >
            {uploading ? 'מעלה...' : 'העלה'}
          </button>
        </div>
      ) : null}
    </div>
  );
}

async function compressIfNeeded(
  file: File,
  maxSizeBytes: number
): Promise<File> {
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

    // Resize if needed (max 1600px)
    const MAX_DIMENSION = 1600;
    if (canvas.width > MAX_DIMENSION || canvas.height > MAX_DIMENSION) {
      const ratio = Math.min(
        MAX_DIMENSION / canvas.width,
        MAX_DIMENSION / canvas.height
      );
      canvas.width = Math.round(canvas.width * ratio);
      canvas.height = Math.round(canvas.height * ratio);
    }

    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const attempt = (quality: number, type: string) =>
      new Promise<Blob | null>((resolve) => {
        (canvas as HTMLCanvasElement).toBlob(
          (blob) => resolve(blob),
          type,
          Math.min(Math.max(quality, 0.3), 0.92)
        );
      });

    // Heuristic quality based on ratio
    const ratio = maxSizeBytes / Math.max(1, file.size);
    const baseQ = 0.65; // Default aggressive quality

    // Try WebP first
    let blob = await attempt(baseQ, 'image/webp');
    let type = 'image/webp';

    // Fallback to JPEG if WebP fails or is larger (unlikely but possible)
    if (!blob) {
      blob = await attempt(baseQ, 'image/jpeg');
      type = 'image/jpeg';
    }

    if (!blob) return file;

    // If still too large, reduce quality
    if (blob.size > maxSizeBytes) {
      blob = await attempt(baseQ * 0.7, type);
      if (!blob) return file;
    }
    if (blob.size > maxSizeBytes) {
      blob = await attempt(baseQ * 0.5, type);
      if (!blob) return file;
    }

    // If compression actually made it larger (unlikely with resize), keep original
    if (blob.size >= file.size) {
      return file;
    }

    const ext = type === 'image/webp' ? 'webp' : 'jpg';
    const newName = file.name.replace(/\.[^/.]+$/, '') + '.' + ext;

    const out = new File([blob], newName, {
      type: type,
      lastModified: Date.now(),
    });
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
