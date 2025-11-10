'use client';

import React, { useCallback, useEffect, useMemo, useRef } from 'react';

export type ChecklistField =
  | {
      id: string;
      type: 'boolean';
      title: string;
      description?: string;
      required?: boolean;
    }
  | {
      id: string;
      type: 'string';
      title: string;
      description?: string;
      required?: boolean;
    }
  | {
      id: string;
      type: 'textarea';
      title: string;
      description?: string;
      required?: boolean;
    };

export type ChecklistSchema = ReadonlyArray<ChecklistField>;

export type ChecklistModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schema: ChecklistSchema;
  onSubmit: (data: Record<string, unknown>) => void;
  title?: string;
  description?: string;
};

export function ChecklistModal(props: ChecklistModalProps) {
  const { open, onOpenChange, schema, onSubmit, title = 'צ’ק-ליסט', description } = props;

  // Focus management / trap
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocusedEl = useRef<HTMLElement | null>(null);

  const focusableSelectors = useMemo(
    () => [
      'a[href]',
      'button:not([disabled])',
      'textarea:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ],
    []
  );

  const getFocusable = useCallback((): HTMLElement[] => {
    const root = panelRef.current;
    if (!root) return [];
    return Array.from(root.querySelectorAll<HTMLElement>(focusableSelectors.join(','))).filter(
      (el) => !el.hasAttribute('disabled') && !el.getAttribute('aria-hidden')
    );
  }, [focusableSelectors]);

  useEffect(() => {
    if (open) {
      previouslyFocusedEl.current = document.activeElement as HTMLElement;
      // Move focus to first focusable in the panel after paint
      setTimeout(() => {
        const focusables = getFocusable();
        if (focusables.length > 0) {
          focusables[0].focus();
        } else {
          panelRef.current?.focus();
        }
      }, 0);
    } else {
      // restore focus when closing
      previouslyFocusedEl.current?.focus?.();
    }
  }, [open, getFocusable]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onOpenChange(false);
      return;
    }
    if (e.key === 'Tab') {
      const focusables = getFocusable();
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const current = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (current === first || !panelRef.current?.contains(current)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (current === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
  };

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40"
      onClick={(e) => {
        if (e.target === overlayRef.current) onOpenChange(false);
      }}
      aria-hidden={false}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="checklist-title"
        aria-describedby={description ? 'checklist-desc' : undefined}
        tabIndex={-1}
        className="w-full sm:max-w-lg sm:rounded-lg sm:shadow-lg bg-white outline-none focus:outline-none max-h-[90vh] sm:max-h-[80vh] overflow-hidden sm:mx-0 mx-0 rounded-t-xl"
        onKeyDown={handleKeyDown}
      >
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <div className="space-y-1">
            <h2 id="checklist-title" className="text-lg font-semibold">
              {title}
            </h2>
            {description ? (
              <p id="checklist-desc" className="text-sm text-gray-600">
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            className="rounded-md px-2 py-1 text-sm text-gray-700 hover:bg-gray-100"
            onClick={() => onOpenChange(false)}
            aria-label="סגור"
          >
            ✕
          </button>
        </div>

        <div className="p-4 overflow-y-auto">
          {/* 5.2.1 scaffold only - form rendering will be implemented in 5.2.2 */}
          <div className="text-sm text-gray-700">
            {/* Show a quick placeholder using the schema length */}
            {schema && schema.length > 0 ? 'הטופס ייטען לפי הסכימה' : 'אין שדות בטופס זה'}
          </div>
        </div>

        <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
          <button
            type="button"
            className="rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
            onClick={() => onOpenChange(false)}
          >
            ביטול
          </button>
          <button
            type="button"
            className="rounded-md bg-toyota-primary px-3 py-2 text-sm text-white hover:bg-red-700"
            onClick={() => onSubmit({})}
          >
            שמור
          </button>
        </div>
      </div>
    </div>
  );
}


