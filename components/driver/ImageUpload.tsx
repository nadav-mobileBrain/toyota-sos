'use client';

import React, { useMemo, useRef, useState } from 'react';

export type ImageUploadFile = {
  file: File;
  id: string; // stable id for rendering (e.g., `${name}-${size}-${lastModified}`)
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

  const handleFiles = (filesList: FileList | File[] | null) => {
    if (!filesList) return;
    const files = Array.from(filesList as any) as File[];
    if (files.length === 0) return;
    const next: ImageUploadFile[] = [];
    for (const f of files) {
      if (!fileAccepted(f)) continue;
      if (maxSizeBytes && f.size > maxSizeBytes) {
        // For scaffold, silently ignore oversize; later subtasks add visible error handling
        continue;
      }
      const id = `${f.name}-${f.size}-${f.lastModified}`;
      next.push({ file: f, id });
    }
    setItems((prev) => {
      const merged = mergeAndDeduplicate(prev, next);
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
    handleFiles(dt.files);
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
          onChange={(e) => handleFiles(e.currentTarget.files)}
          aria-hidden="true"
          tabIndex={-1}
        />
      </div>
    </div>
  );
}


