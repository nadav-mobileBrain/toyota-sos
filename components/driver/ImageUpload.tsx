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

  const empty = items.length === 0;

  const handlePick = () => {
    inputRef.current?.click();
  };

  const handleFiles = (filesList: FileList | null) => {
    if (!filesList || filesList.length === 0) return;
    const next: ImageUploadFile[] = [];
    for (let i = 0; i < filesList.length; i++) {
      const f = filesList.item(i);
      if (!f) continue;
      if (maxSizeBytes && f.size > maxSizeBytes) {
        // For scaffold, silently ignore oversize; later subtasks add visible error handling
        continue;
      }
      const id = `${f.name}-${f.size}-${f.lastModified}`;
      next.push({ file: f, id });
    }
    setItems((prev) => {
      const merged = multiple ? [...prev, ...next] : next.slice(0, 1);
      onChange?.(merged);
      return merged;
    });
  };

  return (
    <div className={className ?? ''} dir="rtl" data-testid="image-upload">
      <div
        className="rounded-md border-2 border-dashed border-gray-300 p-4 text-center text-sm text-gray-600"
        aria-label="אזור העלאת תמונות"
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


