'use client';

import React, { useEffect, useMemo, useState } from 'react';

// Core option/constraints types
export type FormOption = {
  value: string | number;
  label: string;
};

export type FormConstraints = {
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string; // regex string
};

// Simple dependency rules for conditional visibility/enablement
export type DependencyRule = {
  fieldId: string;
  operator: 'equals' | 'notEquals' | 'in';
  value: unknown;
};

export type DependencyConfig = {
  when: 'all' | 'any';
  rules: ReadonlyArray<DependencyRule>;
};

// Field definitions
export type FieldType =
  | 'text'
  | 'textarea'
  | 'select'
  | 'checkbox'
  | 'radio'
  | 'number'
  | 'date'
  | 'time';

export type FormFieldBase = {
  id: string;
  type: FieldType;
  title: string;
  description?: string;
  required?: boolean;
  constraints?: FormConstraints;
  dependsOn?: DependencyConfig; // visibility/enable rules
  defaultValue?: unknown;
};

export type SelectLikeField = FormFieldBase & {
  type: 'select' | 'radio';
  options: ReadonlyArray<FormOption>;
};

export type CheckboxField = FormFieldBase & {
  type: 'checkbox';
  defaultValue?: boolean;
};

export type TextualField = FormFieldBase & {
  type: 'text' | 'textarea' | 'number' | 'date' | 'time';
};

export type FormField = SelectLikeField | CheckboxField | TextualField;
export type FormSchema = ReadonlyArray<FormField>;

// Normalized payload format
export type NormalizedFormData = Record<string, string | number | boolean | null>;

export type FormRendererProps = {
  schema: FormSchema;
  initialValues?: Record<string, unknown>;
  onChange?: (data: NormalizedFormData) => void;
  onSubmit?: (data: NormalizedFormData) => void;
  className?: string;
};

/**
 * FormRenderer (scaffold)
 * 5.3.1: Types and basic component shell. Rendering and behavior will be added in later subtasks.
 */
export function FormRenderer(props: FormRendererProps) {
  const { schema, className, initialValues, onChange, onSubmit } = props;

  const [values, setValues] = useState<NormalizedFormData>({});
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Initialize values
  useEffect(() => {
    const init: NormalizedFormData = {};
    for (const f of schema) {
      const iv = initialValues?.[f.id];
      if (typeof iv !== 'undefined') {
        init[f.id] = coerceValue(f.type, iv);
      } else if (typeof f.defaultValue !== 'undefined') {
        init[f.id] = coerceValue(f.type, f.defaultValue);
      } else {
        init[f.id] = defaultForType(f.type);
      }
    }
    setValues(init);
  }, [schema, initialValues]);

  // Lift state changes
  useEffect(() => {
    // Provide normalized visible payload on change
    const visible = schema.filter((f) => evaluateDependencies(f.dependsOn, values));
    onChange?.(buildNormalizedPayload(visible, values));
  }, [values, onChange, schema]);

  const visibleSchema = useMemo(() => {
    return schema.filter((f) => evaluateDependencies(f.dependsOn, values));
  }, [schema, values]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Validate all visible fields
    const nextErrors: Record<string, string | null> = {};
    for (const f of visibleSchema) {
      nextErrors[f.id] = validateField(f, values[f.id]);
    }
    setErrors(nextErrors);
    // If any errors, focus first and abort submit
    const firstInvalid = visibleSchema.find((f) => nextErrors[f.id]);
    if (firstInvalid) {
      const el = document.getElementById(`fr-${firstInvalid.id}`);
      el?.focus?.();
      return;
    }
    // Build normalized payload for visible fields only
    const submit = buildNormalizedPayload(visibleSchema, values);
    onSubmit?.(submit);
  };

  const setFieldValue = (field: FormField, raw: unknown) => {
    setValues((v) => {
      const next = { ...v, [field.id]: coerceValue(field.type, raw) };
      return next;
    });
    // live-validate if already touched
    setErrors((prev) => {
      if (!touched[field.id]) return prev;
      return { ...prev, [field.id]: validateField(field, coerceValue(field.type, raw)) };
    });
  };

  const markTouched = (id: string) => setTouched((t) => ({ ...t, [id]: true }));

  return (
    <form dir="rtl" className={className ?? ''} data-testid="form-renderer" onSubmit={handleSubmit}>
      {!visibleSchema?.length ? (
        <div className="text-sm text-gray-600">לא הוגדרה סכימה לטופס זה</div>
      ) : (
        <div className="space-y-4">
          {visibleSchema.map((f) => {
            const id = `fr-${f.id}`;
            const descId = f.description ? `${id}-desc` : undefined;
            const errorId = `${id}-error`;
            const describedBy = [descId, errors[f.id] ? errorId : undefined].filter(Boolean).join(' ') || undefined;
            const value = values[f.id];
            const errorMsg = errors[f.id] ?? null;
            // checkbox
            if (f.type === 'checkbox') {
              const checked = Boolean(value);
              return (
                <div key={f.id} className="flex items-start gap-3">
                  <input
                    id={id}
                    type="checkbox"
                    className="mt-1 h-5 w-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-toyota-primary focus-visible:ring-offset-2"
                    checked={checked}
                    onChange={(e) => setFieldValue(f, e.target.checked)}
                    onBlur={() => {
                      markTouched(f.id);
                      setErrors((prev) => ({ ...prev, [f.id]: validateField(f, checked) }));
                    }}
                    aria-describedby={describedBy}
                    aria-invalid={errorMsg ? 'true' : undefined}
                  />
                  <div className="flex-1">
                    <label htmlFor={id} className="font-medium inline-flex items-center min-h-[44px]">
                      {f.title} {f.required ? <span className="text-red-600">*</span> : null}
                    </label>
                    {f.description ? (
                      <p id={descId} className="text-sm text-gray-600">
                        {f.description}
                      </p>
                    ) : null}
                    {errorMsg ? (
                      <p id={errorId} role="alert" className="text-sm text-red-600">
                        {errorMsg}
                      </p>
                    ) : null}
                  </div>
                </div>
              );
            }
            // radio
            if (f.type === 'radio') {
              const opts = (f as any).options as ReadonlyArray<FormOption>;
              return (
                <fieldset key={f.id} className="space-y-1">
                  <legend className="font-medium">
                    {f.title} {f.required ? <span className="text-red-600">*</span> : null}
                  </legend>
                  {f.description ? (
                    <p id={descId} className="text-sm text-gray-600">
                      {f.description}
                    </p>
                  ) : null}
                  <div className="space-y-1">
                    {opts?.map((opt) => {
                      const rid = `${id}-${String(opt.value)}`;
                      return (
                        <label key={rid} htmlFor={rid} className="flex items-center gap-2 min-h-[44px]">
                          <input
                            id={rid}
                            name={id}
                            type="radio"
                            className="h-4 w-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-toyota-primary focus-visible:ring-offset-2"
                            checked={String(value ?? '') === String(opt.value)}
                            onChange={() => setFieldValue(f, opt.value)}
                            onBlur={() => {
                              markTouched(f.id);
                              setErrors((prev) => ({
                                ...prev,
                                [f.id]: validateField(f, coerceValue(f.type, value)),
                              }));
                            }}
                            aria-invalid={errorMsg ? 'true' : undefined}
                            aria-describedby={describedBy}
                          />
                          <span className="text-sm">{opt.label}</span>
                        </label>
                      );
                    })}
                  </div>
                  {errorMsg ? (
                    <p id={errorId} role="alert" className="text-sm text-red-600">
                      {errorMsg}
                    </p>
                  ) : null}
                </fieldset>
              );
            }
            // select
            if (f.type === 'select') {
              const opts = (f as any).options as ReadonlyArray<FormOption>;
              return (
                <div key={f.id} className="space-y-1">
                  <label htmlFor={id} className="font-medium">
                    {f.title} {f.required ? <span className="text-red-600">*</span> : null}
                  </label>
                  <select
                    id={id}
                    className="w-full rounded-md border border-gray-300 p-2 text-sm min-h-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-toyota-primary focus-visible:ring-offset-2"
                    aria-describedby={describedBy}
                    value={String(value ?? '')}
                    onChange={(e) => setFieldValue(f, e.target.value)}
                    onBlur={() => {
                      markTouched(f.id);
                      setErrors((prev) => ({
                        ...prev,
                        [f.id]: validateField(f, coerceValue(f.type, value)),
                      }));
                    }}
                    aria-invalid={errorMsg ? 'true' : undefined}
                  >
                    <option value="">בחר</option>
                    {opts?.map((opt) => (
                      <option key={String(opt.value)} value={String(opt.value)}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  {f.description ? (
                    <p id={descId} className="text-sm text-gray-600">
                      {f.description}
                    </p>
                  ) : null}
                  {errorMsg ? (
                    <p id={errorId} role="alert" className="text-sm text-red-600">
                      {errorMsg}
                    </p>
                  ) : null}
                </div>
              );
            }
            // textarea
            if (f.type === 'textarea') {
              return (
                <div key={f.id} className="space-y-1">
                  <label htmlFor={id} className="font-medium">
                    {f.title} {f.required ? <span className="text-red-600">*</span> : null}
                  </label>
                  <textarea
                    id={id}
                    className="w-full rounded-md border border-gray-300 p-2 text-sm min-h-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-toyota-primary focus-visible:ring-offset-2"
                    aria-describedby={describedBy}
                    value={String(value ?? '')}
                    onChange={(e) => setFieldValue(f, e.target.value)}
                    onBlur={() => {
                      markTouched(f.id);
                      setErrors((prev) => ({
                        ...prev,
                        [f.id]: validateField(f, coerceValue(f.type, value)),
                      }));
                    }}
                    aria-invalid={errorMsg ? 'true' : undefined}
                    rows={4}
                  />
                  {f.description ? (
                    <p id={descId} className="text-sm text-gray-600">
                      {f.description}
                    </p>
                  ) : null}
                  {errorMsg ? (
                    <p id={errorId} role="alert" className="text-sm text-red-600">
                      {errorMsg}
                    </p>
                  ) : null}
                </div>
              );
            }
            // text/number/date/time
            const inputType = f.type === 'text' ? 'text' : f.type;
            return (
              <div key={f.id} className="space-y-1">
                <label htmlFor={id} className="font-medium">
                  {f.title} {f.required ? <span className="text-red-600">*</span> : null}
                </label>
                <input
                  id={id}
                  type={inputType}
                  className="w-full rounded-md border border-gray-300 p-2 text-sm min-h-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-toyota-primary focus-visible:ring-offset-2"
                  aria-describedby={describedBy}
                  value={formatValueForInput(f.type, value)}
                  onChange={(e) => setFieldValue(f, e.target.value)}
                  onBlur={() => {
                    markTouched(f.id);
                    setErrors((prev) => ({
                      ...prev,
                      [f.id]: validateField(f, coerceValue(f.type, value)),
                    }));
                  }}
                  aria-invalid={errorMsg ? 'true' : undefined}
                />
                {f.description ? (
                  <p id={descId} className="text-sm text-gray-600">
                    {f.description}
                  </p>
                ) : null}
                {errorMsg ? (
                  <p id={errorId} role="alert" className="text-sm text-red-600">
                    {errorMsg}
                  </p>
                ) : null}
              </div>
            );
          })}
          {onSubmit ? (
            <div>
              <button
                type="submit"
                className="rounded-md bg-toyota-primary px-3 py-2 text-sm text-white hover:bg-red-700 min-h-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-toyota-primary focus-visible:ring-offset-2"
              >
                שמור
              </button>
            </div>
          ) : null}
        </div>
      )}
    </form>
  );
}

function defaultForType(t: FieldType): string | number | boolean | null {
  switch (t) {
    case 'checkbox':
      return false;
    case 'number':
      return '' as unknown as number; // empty until user inputs; coerced on change
    default:
      return '';
  }
}

function isEmptyForType(t: FieldType, v: unknown): boolean {
  if (t === 'checkbox') return v !== true;
  if (t === 'number') return v === '' || v === null || typeof v === 'undefined';
  return String(v ?? '').trim().length === 0;
}

function evaluateDependencies(dep: DependencyConfig | undefined, data: NormalizedFormData): boolean {
  if (!dep || !dep.rules?.length) return true;
  const evalRule = (r: DependencyRule): boolean => {
    const current = data[r.fieldId];
    switch (r.operator) {
      case 'equals':
        return current === r.value;
      case 'notEquals':
        return current !== r.value;
      case 'in':
        return Array.isArray(r.value) ? (r.value as unknown[]).some((v) => v === current) : false;
      default:
        return false;
    }
  };
  const results = dep.rules.map(evalRule);
  return dep.when === 'any' ? results.some(Boolean) : results.every(Boolean);
}

function buildNormalizedPayload(visible: ReadonlyArray<FormField>, raw: NormalizedFormData): NormalizedFormData {
  const out: NormalizedFormData = {};
  for (const f of visible) {
    const value = raw[f.id];
    switch (f.type) {
      case 'checkbox': {
        out[f.id] = Boolean(value);
        break;
      }
      case 'number': {
        const s = String(value ?? '');
        out[f.id] = s === '' ? null : Number(s);
        break;
      }
      case 'date':
      case 'time': {
        const s = String(value ?? '');
        out[f.id] = s === '' ? null : s;
        break;
      }
      case 'select':
      case 'radio': {
        // Return the option's original typed value (string or number) if possible
        const s = String(value ?? '');
        const opts = (f as any).options as ReadonlyArray<FormOption>;
        const match = opts?.find((o) => String(o.value) === s);
        out[f.id] = s === '' ? null : (match ? match.value : s);
        break;
      }
      default: {
        const s = String(value ?? '');
        out[f.id] = s;
      }
    }
  }
  return out;
}

function validateField(field: FormField, rawValue: unknown): string | null {
  const v = rawValue;
  // required
  if (field.required && isEmptyForType(field.type, v)) {
    return 'שדה חובה';
  }
  // constraints
  const c = field.constraints;
  if (!c) return null;
  if (field.type === 'text' || field.type === 'textarea') {
    const s = String(v ?? '');
    if (typeof c.minLength === 'number' && s.length < c.minLength) {
      return `מינימום ${c.minLength} תווים`;
    }
    if (typeof c.maxLength === 'number' && s.length > c.maxLength) {
      return `מקסימום ${c.maxLength} תווים`;
    }
    if (c.pattern) {
      try {
        const re = new RegExp(c.pattern);
        if (s && !re.test(s)) {
          return 'פורמט לא תקין';
        }
      } catch {
        // ignore invalid regex
      }
    }
  }
  if (field.type === 'number') {
    const n = Number(v);
    if (String(v) !== '' && !Number.isFinite(n)) {
      return 'מספר לא תקין';
    }
    if (typeof c.min === 'number' && String(v) !== '' && n < c.min) {
      return `ערך מינימלי ${c.min}`;
    }
    if (typeof c.max === 'number' && String(v) !== '' && n > c.max) {
      return `ערך מקסימלי ${c.max}`;
    }
  }
  // For date/time we keep only required for now
  return null;
}

function coerceValue(t: FieldType, v: unknown): string | number | boolean | null {
  if (v === null || typeof v === 'undefined') return '';
  switch (t) {
    case 'checkbox':
      return Boolean(v);
    case 'number': {
      const n = Number(v);
      return Number.isFinite(n) ? n : String(v ?? '');
    }
    case 'date':
    case 'time':
      return String(v);
    default:
      return String(v);
  }
}

function formatValueForInput(t: FieldType, v: unknown): string | number {
  if (v === null || typeof v === 'undefined') return '';
  if (t === 'number') {
    if (v === '') return '';
    const n = Number(v);
    return Number.isFinite(n) ? n : '';
  }
  return String(v);
}


