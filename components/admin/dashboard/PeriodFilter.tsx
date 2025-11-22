/* eslint-disable max-lines */
'use client';

import React from 'react';
import { usePeriod, PeriodRange } from './PeriodContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { he } from 'date-fns/locale';
import { z } from 'zod';
import dayjs from '@/lib/dayjs';

function isoDayStart(d: Date) {
  return dayjs(d).startOf('day').toISOString();
}
function isoDayEnd(d: Date) {
  return dayjs(d).endOf('day').toISOString();
}

function makeRange(
  kind: 'today' | 'yesterday' | 'last7' | 'last30'
): PeriodRange {
  const now = dayjs();
  if (kind === 'today') {
    const start = now.startOf('day').toISOString();
    const end = now.endOf('day').toISOString();
    return { start, end, timezone: 'UTC' };
  }
  if (kind === 'yesterday') {
    const y = now.subtract(1, 'day');
    return { start: y.startOf('day').toISOString(), end: y.endOf('day').toISOString(), timezone: 'UTC' };
  }
  const days = kind === 'last7' ? 7 : 30;
  const startDate = now.subtract(days, 'day').startOf('day');
  return {
    start: startDate.toISOString(),
    end: now.endOf('day').toISOString(),
    timezone: 'UTC',
  };
}

// Safari does not reliably parse YYYY-MM-DD via new Date(). Parse manually.
function parseDateInput(value: string): Date | null {
  if (!value) return null;
  const parts = value.split('-').map((p) => Number(p));
  if (parts.length !== 3) return null;
  const [y, m, d] = parts;
  if (!y || !m || !d) return null;
  const dt = dayjs(`${y}-${m}-${d}`, 'YYYY-M-D');
  return dt.isValid() ? dt.toDate() : null;
}

function formatInputDate(d: Date | null): string {
  if (!d) return '';
  return dayjs(d).format('YYYY-MM-DD');
}

const dateRangeSchema = z
  .object({
    from: z.date(),
    to: z.date(),
  })
  .refine((data) => data.from <= data.to, {
    message: 'תאריך התחלה חייב להיות לפני או שווה לתאריך הסיום',
    path: ['from'],
  })
  .refine(
    (data) => {
      const now = dayjs().endOf('day');
      return dayjs(data.to).isBefore(now) || dayjs(data.to).isSame(now, 'day');
    },
    {
      message: 'תאריך סיום לא יכול להיות בעתיד',
      path: ['to'],
    }
  )
  .refine(
    (data) => {
      const diffDays = dayjs(data.to).diff(dayjs(data.from), 'day');
      return Math.abs(diffDays) <= 365;
    },
    {
      message: 'הטווח לא יכול להיות גדול מ-365 ימים',
      path: ['to'],
    }
  );

function validateDateRange(
  customFrom: string,
  customTo: string
): { from?: string; to?: string } | null {
  const fromDate = parseDateInput(customFrom);
  const toDate = parseDateInput(customTo);

  if (!customFrom && !customTo) return null;
  if (!customFrom || !customTo) {
    return {
      from: !customFrom ? 'תאריך התחלה נדרש' : undefined,
      to: !customTo ? 'תאריך סיום נדרש' : undefined,
    };
  }
  if (!fromDate || !toDate) {
    return {
      from: !fromDate ? 'תאריך התחלה לא תקין' : undefined,
      to: !toDate ? 'תאריך סיום לא תקין' : undefined,
    };
  }

  const result = dateRangeSchema.safeParse({ from: fromDate, to: toDate });
  if (!result.success) {
    const zodErrors: { from?: string; to?: string } = {};
    result.error.issues.forEach((issue) => {
      if (issue.path[0] === 'from') zodErrors.from = issue.message;
      else if (issue.path[0] === 'to') zodErrors.to = issue.message;
    });
    return zodErrors;
  }
  return null;
}

function sameCalendarDay(a: Date, b: Date): boolean {
  return dayjs(a).isSame(dayjs(b), 'day');
}

function inferPreset(
  range: PeriodRange
): 'today' | 'yesterday' | 'last7' | 'last30' | 'custom' {
  const start = dayjs(range.start);
  const end = dayjs(range.end);
  const today = dayjs();

  const diffDays = Math.abs(end.diff(start, 'day'));

  // today: start and end both today
  if (start.isSame(today, 'day') && end.isSame(today, 'day')) {
    return 'today';
  }

  // yesterday: start and end both yesterday
  const yesterday = today.subtract(1, 'day');
  if (start.isSame(yesterday, 'day') && end.isSame(yesterday, 'day')) {
    return 'yesterday';
  }

  // last 7 days: end is today, and span is 7 days
  if (end.isSame(today, 'day') && diffDays === 7) {
    return 'last7';
  }

  // last 30 days: end is today, and span is 30 days
  if (end.isSame(today, 'day') && diffDays === 30) {
    return 'last30';
  }

  return 'custom';
}

function DatePickerInput({
  label,
  value,
  error,
  open,
  onOpenChange,
  onSelect,
  disabled,
}: {
  label: string;
  value: string;
  error?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (date: Date) => void;
  disabled: (date: Date) => boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <label className="text-sm text-gray-700">{label}</label>
        <Popover open={open} onOpenChange={onOpenChange}>
          <PopoverTrigger asChild>
            <Input
              type="text"
              className={`text-sm cursor-pointer w-[140px] ${
                error ? 'border-red-500' : ''
              }`}
              placeholder="YYYY-MM-DD"
              readOnly
              value={value}
            />
          </PopoverTrigger>
          <PopoverContent
            className="w-auto p-0 bg-white z-[100]"
            align="end"
            side="bottom"
            sideOffset={8}
            dir="rtl"
          >
            <Calendar
              mode="single"
              selected={parseDateInput(value) ?? undefined}
              onSelect={(date) => {
                if (date) {
                  onSelect(date);
                  onOpenChange(false);
                }
              }}
              locale={he}
              defaultMonth={parseDateInput(value) ?? new Date()}
              className="rounded-md border bg-white"
              captionLayout="dropdown"
              disabled={disabled}
            />
          </PopoverContent>
        </Popover>
      </div>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}

export function PeriodFilter({
  onChange,
}: {
  onChange?: (r: PeriodRange) => void;
}) {
  const { range, setRange } = usePeriod();
  const [customOpen, setCustomOpen] = React.useState(false);
  const [customFrom, setCustomFrom] = React.useState<string>('');
  const [customTo, setCustomTo] = React.useState<string>('');
  const [showFromCal, setShowFromCal] = React.useState(false);
  const [showToCal, setShowToCal] = React.useState(false);
  const [errors, setErrors] = React.useState<{
    from?: string;
    to?: string;
    general?: string;
  }>({});

  React.useEffect(() => {
    if (customOpen && (customFrom || customTo)) {
      const validationErrors = validateDateRange(customFrom, customTo);
      setErrors(validationErrors || {});
    }
  }, [customFrom, customTo, customOpen]);

  const currentPreset = React.useMemo(() => inferPreset(range), [range]);

  const apply = (r: PeriodRange) => {
    setRange(r);
    onChange?.(r);
  };

  const resetCustom = () => {
    setCustomOpen(false);
    setShowFromCal(false);
    setShowToCal(false);
    setCustomFrom('');
    setCustomTo('');
    setErrors({});
  };

  const applyPreset = (kind: 'today' | 'yesterday' | 'last7' | 'last30') => {
    resetCustom();
    apply(makeRange(kind));
  };

  const handleApply = () => {
    const validationErrors = validateDateRange(customFrom, customTo);
    if (validationErrors) {
      setErrors(validationErrors);
      return;
    }

    const start = parseDateInput(customFrom);
    const end = parseDateInput(customTo);
    if (!start || !end) return;

    apply({
      start: isoDayStart(start),
      end: isoDayEnd(end),
      timezone: 'UTC',
    });
    setCustomOpen(false);
    setShowFromCal(false);
    setShowToCal(false);
    setCustomFrom('');
    setCustomTo('');
    setErrors({});
  };

  return (
    <div dir="rtl" className="flex flex-wrap items-center gap-2">
      <div
        className="inline-flex rounded-lg border border-gray-300 bg-gray-100 p-1"
        role="group"
        aria-label="טווח זמן"
      >
        <Button
          variant="ghost"
          className={`px-3 py-1 text-sm rounded ${
            currentPreset === 'today' && !customOpen
              ? 'bg-primary/10 text-primary'
              : 'bg-white text-gray-800'
          }`}
          onClick={() => applyPreset('today')}
        >
          היום
        </Button>
        <Button
          variant="ghost"
          className={`px-3 py-1 text-sm rounded ${
            currentPreset === 'yesterday' && !customOpen
              ? 'bg-primary/10 text-primary'
              : 'bg-white text-gray-800'
          }`}
          onClick={() => applyPreset('yesterday')}
        >
          אתמול
        </Button>
        <Button
          variant="ghost"
          className={`px-3 py-1 text-sm rounded ${
            currentPreset === 'last7' && !customOpen
              ? 'bg-primary/10 text-primary'
              : 'bg-white text-gray-800'
          }`}
          onClick={() => applyPreset('last7')}
        >
          7 ימים
        </Button>
        <Button
          variant="ghost"
          className={`px-3 py-1 text-sm rounded ${
            currentPreset === 'last30' && !customOpen
              ? 'bg-primary/10 text-primary'
              : 'bg-white text-gray-800'
          }`}
          onClick={() => applyPreset('last30')}
        >
          30 ימים
        </Button>
        <Button
          variant="ghost"
          className={`px-3 py-1 text-sm rounded ${
            currentPreset === 'custom' || customOpen
              ? 'bg-primary/10 text-primary'
              : 'bg-white text-gray-800'
          }`}
          onClick={() => setCustomOpen((v) => !v)}
          aria-expanded={customOpen}
        >
          מותאם
        </Button>
      </div>

      {customOpen && (
        <div className="flex flex-col gap-2">
          <div className="flex items-start gap-2">
            <DatePickerInput
              label="מ"
              value={customFrom}
              error={errors.from}
              open={showFromCal}
              onOpenChange={(open) => {
                setShowFromCal(open);
                if (open) setShowToCal(false);
              }}
              onSelect={(date) => setCustomFrom(formatInputDate(date))}
              disabled={(date) => {
                const toDate = parseDateInput(customTo);
                const dateDayjs = dayjs(date);
                return toDate ? dateDayjs.isAfter(dayjs(toDate), 'day') : dateDayjs.isAfter(dayjs(), 'day');
              }}
            />
            <DatePickerInput
              label="עד"
              value={customTo}
              error={errors.to}
              open={showToCal}
              onOpenChange={(open) => {
                setShowToCal(open);
                if (open) setShowFromCal(false);
              }}
              onSelect={(date) => setCustomTo(formatInputDate(date))}
              disabled={(date) => {
                const fromDate = parseDateInput(customFrom);
                const dateDayjs = dayjs(date);
                return fromDate ? dateDayjs.isBefore(dayjs(fromDate), 'day') : dateDayjs.isAfter(dayjs(), 'day');
              }}
            />
            <Button
              className="bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-1 text-sm font-semibold"
              onClick={handleApply}
              disabled={
                !!errors.from || !!errors.to || !customFrom || !customTo
              }
            >
              החל
            </Button>
          </div>
          {errors.general && (
            <span className="text-xs text-red-500">{errors.general}</span>
          )}
        </div>
      )}

      <div className="ml-auto text-xs text-gray-600">
        {(() => {
          const label =
            currentPreset === 'today'
              ? 'היום'
              : currentPreset === 'yesterday'
              ? 'אתמול'
              : currentPreset === 'last7'
              ? '7 ימים'
              : currentPreset === 'last30'
              ? '30 ימים'
              : 'מותאם';
          return (
            <>
              טווח נוכחי: <span className="font-semibold">{label}</span> (
              {dayjs(range.start).format('DD/MM/YYYY')} –{' '}
              {dayjs(range.end).format('DD/MM/YYYY')})
            </>
          );
        })()}
      </div>
    </div>
  );
}
