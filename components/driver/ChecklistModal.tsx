'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  startTransition,
} from 'react';
import { createBrowserClient } from '@/lib/auth';
import { SaveIcon, X } from 'lucide-react';

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
  // 5.2.5 persistence props
  persist?: boolean;
  taskId?: string;
  driverId?: string;
  /**
   * When true, the modal cannot be dismissed until a successful submit.
   * Used for mandatory checklists on status changes.
   */
  forceCompletion?: boolean;
};

export function ChecklistModal(props: ChecklistModalProps) {
  const {
    open,
    onOpenChange,
    schema,
    onSubmit,
    title = 'צ’ק-ליסט',
    description,
    persist = false,
    taskId,
    driverId,
    forceCompletion = false,
  } = props;

  // Focus management / trap
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocusedEl = useRef<HTMLElement | null>(null);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [attempted, setAttempted] = useState(false);
  const [persistError, setPersistError] = useState<string | null>(null);
  const [persisting, setPersisting] = useState(false);

  // Allow dismissing if not forced, or if persistence failed (so the user isn't trapped).
  const canDismiss = !forceCompletion || !!persistError;

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
    return Array.from(
      root.querySelectorAll<HTMLElement>(focusableSelectors.join(','))
    ).filter(
      (el) => !el.hasAttribute('disabled') && !el.getAttribute('aria-hidden')
    );
  }, [focusableSelectors]);

  // Compute initial values based on schema
  const initialValues = useMemo(() => {
    const initial: Record<string, unknown> = {};
    for (const f of schema) {
      if (f.type === 'boolean') initial[f.id] = false;
      else initial[f.id] = '';
    }
    return initial;
  }, [schema]);

  useEffect(() => {
    if (open) {
      // Initialize values from schema (using computed initial values)
      // Wrap state updates in startTransition to avoid cascading renders
      startTransition(() => {
        setValues(initialValues);
        setErrors({});
        setAttempted(false);
      });

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
  }, [open, getFocusable, initialValues]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      if (canDismiss) {
        onOpenChange(false);
      }
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

  const handleChange = (id: string, next: unknown) => {
    setValues((v) => ({ ...v, [id]: next }));
    if (attempted) {
      // Live-validate the edited field after attempt
      setErrors((prev) => {
        const nextErrors = { ...prev };
        nextErrors[id] = computeFieldError(id, next);
        return nextErrors;
      });
    }
  };

  const computeFieldError = (id: string, val: unknown): string | undefined => {
    const field = schema.find((f) => f.id === id);
    if (!field || !field.required) return undefined;
    if (field.type === 'boolean') {
      return val === true ? undefined : 'שדה חובה';
    }
    // string/textarea
    const s = String(val ?? '').trim();
    return s.length > 0 ? undefined : 'שדה חובה';
  };

  const validateAll = (): Record<string, string | undefined> => {
    const e: Record<string, string | undefined> = {};
    for (const f of schema) {
      e[f.id] = computeFieldError(f.id, values[f.id]);
    }
    return e;
  };

  const getGeoPosition = async (): Promise<{
    lat: number;
    lng: number;
    accuracy?: number;
  } | null> => {
    try {
      if (typeof window === 'undefined' || !('geolocation' in navigator))
        return null;
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        const onSuccess = (p: GeolocationPosition) => resolve(p);
        const onError = (err: GeolocationPositionError) => reject(err);
        navigator.geolocation.getCurrentPosition(onSuccess, onError, {
          enableHighAccuracy: true,
          timeout: 4000,
          maximumAge: 0,
        });
      });
      return {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      };
    } catch {
      return null;
    }
  };

  const handleSubmit = async () => {
    setAttempted(true);
    const e = validateAll();
    setErrors(e);
    const firstInvalid = schema.find((f) => e[f.id]);
    if (firstInvalid) {
      // Focus first invalid field
      const el = panelRef.current?.querySelector<HTMLElement>(
        `#field-${firstInvalid.id}`
      );
      el?.focus();
      return;
    }
    const gps = await getGeoPosition();
    const payload = gps ? { ...values, gps_location: gps } : values;
    // Persist if configured and we have a taskId
    if (persist && taskId) {
      try {
        setPersisting(true);
        setPersistError(null);
        const supa = createBrowserClient();

        // Use the RPC function to submit, passing driverId explicitly if available
        // This handles cases where auth.uid() is null (localStorage session)
        const { error } = await supa.rpc('submit_task_form', {
          p_task_id: taskId,
          p_form_data: payload,
          p_gps_location: gps || null,
          p_driver_id: driverId || undefined,
        });

        if (error) {
          setPersistError(error.message || 'שמירה נכשלה');
          setPersisting(false);
          return;
        }
        setPersisting(false);
        onSubmit(payload);
        onOpenChange(false);
      } catch (err: unknown) {
        const error = err as Error;
        setPersistError(error.message || 'שמירה נכשלה');
        setPersisting(false);
      }
    } else {
      onSubmit(payload);
    }
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-9999 flex items-end sm:items-center justify-center bg-black/40"
      onClick={(e) => {
        if (e.target === overlayRef.current && canDismiss) onOpenChange(false);
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
        className="w-full sm:max-w-lg sm:rounded-lg sm:shadow-lg bg-white outline-none focus:outline-none max-h-[85vh] sm:max-h-[80vh] flex flex-col overflow-hidden sm:mx-0 mx-4 mb-4 sm:mb-0 rounded-xl shadow-2xl"
        onKeyDown={handleKeyDown}
      >
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between shrink-0">
          <div className="space-y-1 flex-1 min-w-0 pr-2">
            <h2 id="checklist-title" className="text-lg font-semibold">
              {title}
            </h2>
            {description ? (
              <p id="checklist-desc" className="text-sm text-gray-600">
                {description}
              </p>
            ) : null}
          </div>
          {canDismiss ? (
            <button
              type="button"
              className="inline-flex h-11 w-11 items-center justify-center rounded-md text-sm text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-primary shrink-0"
              onClick={() => onOpenChange(false)}
              aria-label="סגור"
            >
              ✕
            </button>
          ) : null}
        </div>

        <div className="p-4 overflow-y-auto flex-1 min-h-0 overscroll-contain">
          {schema && schema.length > 0 ? (
            <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
              {schema.map((field) => {
                const baseId = `field-${field.id}`;
                const descId = field.description ? `${baseId}-desc` : undefined;
                if (field.type === 'boolean') {
                  const val = Boolean(values[field.id]);
                  const err = errors[field.id];
                  const errId = err ? `${baseId}-error` : undefined;
                  return (
                    <div key={field.id} className="flex items-start gap-3">
                      <input
                        id={baseId}
                        type="checkbox"
                        className="mt-1 h-5 w-5 focus:outline-none focus:ring-2 focus:ring-primary"
                        aria-describedby={
                          [descId, errId].filter(Boolean).join(' ') || undefined
                        }
                        aria-invalid={err ? 'true' : undefined}
                        checked={val}
                        onChange={(e) =>
                          handleChange(field.id, e.target.checked)
                        }
                      />
                      <div className="flex-1">
                        <label htmlFor={baseId} className="font-medium">
                          {field.title}{' '}
                          {field.required ? (
                            <span className="text-red-600">*</span>
                          ) : null}
                        </label>
                        {field.description ? (
                          <p id={descId} className="text-sm text-gray-600">
                            {field.description}
                          </p>
                        ) : null}
                        {err ? (
                          <p
                            id={errId}
                            role="alert"
                            className="text-sm text-red-600"
                          >
                            {err}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  );
                }
                if (field.type === 'textarea') {
                  const val = String(values[field.id] ?? '');
                  const err = errors[field.id];
                  const errId = err ? `${baseId}-error` : undefined;
                  return (
                    <div key={field.id} className="space-y-1">
                      <label htmlFor={baseId} className="font-medium">
                        {field.title}{' '}
                        {field.required ? (
                          <span className="text-red-600">*</span>
                        ) : null}
                      </label>
                      <textarea
                        id={baseId}
                        className="w-full rounded-md border border-gray-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
                        aria-describedby={
                          [descId, errId].filter(Boolean).join(' ') || undefined
                        }
                        aria-invalid={err ? 'true' : undefined}
                        value={val}
                        onChange={(e) => handleChange(field.id, e.target.value)}
                        rows={4}
                      />
                      {field.description ? (
                        <p id={descId} className="text-sm text-gray-600">
                          {field.description}
                        </p>
                      ) : null}
                      {err ? (
                        <p
                          id={errId}
                          role="alert"
                          className="text-sm text-red-600"
                        >
                          {err}
                        </p>
                      ) : null}
                    </div>
                  );
                }
                // string
                const val = String(values[field.id] ?? '');
                const err = errors[field.id];
                const errId = err ? `${baseId}-error` : undefined;
                return (
                  <div key={field.id} className="space-y-1">
                    <label htmlFor={baseId} className="font-medium">
                      {field.title}{' '}
                      {field.required ? (
                        <span className="text-red-600">*</span>
                      ) : null}
                    </label>
                    <input
                      id={baseId}
                      type="text"
                      className="w-full rounded-md border border-gray-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
                      aria-describedby={
                        [descId, errId].filter(Boolean).join(' ') || undefined
                      }
                      aria-invalid={err ? 'true' : undefined}
                      value={val}
                      onChange={(e) => handleChange(field.id, e.target.value)}
                    />
                    {field.description ? (
                      <p id={descId} className="text-sm text-gray-600">
                        {field.description}
                      </p>
                    ) : null}
                    {err ? (
                      <p
                        id={errId}
                        role="alert"
                        className="text-sm text-red-600"
                      >
                        {err}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </form>
          ) : (
            <div className="text-sm text-gray-700">אין שדות בטופס זה</div>
          )}
        </div>

        <div className="px-4 py-4 border-t border-gray-200 flex items-center justify-between gap-3 shrink-0 bg-white">
          {canDismiss ? (
            <button
              type="button"
              className="rounded-md flex items-center justify-center gap-2 bg-gray-100 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-primary min-h-[48px] flex-1 sm:flex-initial touch-manipulation transition-colors"
              onClick={() => onOpenChange(false)}
            >
              <X className="w-4 h-4" />
              ביטול
            </button>
          ) : (
            <span className="flex-1 sm:hidden" />
          )}
          <button
            type="button"
            className="rounded-md flex items-center justify-center gap-2 bg-primary px-4 py-3 text-sm font-medium text-white hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 min-h-[48px] flex-1 sm:flex-initial disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation transition-colors"
            onClick={handleSubmit}
            disabled={persisting}
          >
            <SaveIcon className="w-4 h-4 mr-2" />
            {persisting ? 'שומר…' : 'שמור'}
          </button>
        </div>
        {persistError ? (
          <div
            role="alert"
            className="px-4 py-2 text-sm text-red-700 bg-red-50 border-t border-red-200"
          >
            {persistError}
          </div>
        ) : null}
      </div>
    </div>
  );
}
