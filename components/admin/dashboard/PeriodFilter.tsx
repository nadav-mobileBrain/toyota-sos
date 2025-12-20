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
    return {
      start: y.startOf('day').toISOString(),
      end: y.endOf('day').toISOString(),
      timezone: 'UTC',
    };
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

// function sameCalendarDay(a: Date, b: Date): boolean {
//   return dayjs(a).isSame(dayjs(b), 'day');
// }

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
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <label className="text-sm font-bold text-slate-800 bg-slate-100/80 px-2.5 py-1 rounded-md border border-slate-200/60">
          {label}
        </label>
        <Popover open={open} onOpenChange={onOpenChange}>
          <PopoverTrigger asChild>
            <Input
              type="text"
              className={`text-sm cursor-pointer w-[150px] bg-white hover:bg-slate-50 focus:bg-white shadow-md hover:shadow-lg transition-all duration-200 border-slate-200/60 hover:border-[#D4001A]/30 focus:border-[#D4001A] focus:ring-2 focus:ring-[#D4001A]/20 rounded-lg font-medium ${
                error
                  ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                  : ''
              }`}
              placeholder="YYYY-MM-DD"
              readOnly
              value={value}
            />
          </PopoverTrigger>
          <PopoverContent
            className="w-auto p-0 bg-white z-100 shadow-xl border-slate-200/60 rounded-xl backdrop-blur-sm"
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
              className="rounded-xl border bg-white shadow-sm"
              captionLayout="dropdown"
              disabled={disabled}
            />
          </PopoverContent>
        </Popover>
      </div>
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5">
          <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
          <span className="text-xs text-red-600 font-medium">{error}</span>
        </div>
      )}
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
    <div dir="rtl" className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div
          className="inline-flex rounded-xl border border-slate-200/60 bg-linear-to-r from-slate-50 to-white p-1.5 shadow-lg backdrop-blur-sm"
          role="group"
          aria-label="טווח זמן"
        >
          <Button
            variant="ghost"
            size="default"
            className={`relative px-5 py-3 text-lg font-semibold rounded-lg transition-all duration-300 transform ${
              currentPreset === 'today' && !customOpen
                ? 'bg-linear-to-r from-[#D4001A] to-[#B8001A] text-white shadow-xl ring-2 ring-[#D4001A]/30 ring-offset-2 ring-offset-white scale-105 hover:shadow-2xl hover:from-[#E4002A] hover:to-[#C8002A] border border-[#D4001A]/20'
                : 'bg-white/70 text-slate-700 hover:bg-white hover:text-slate-900 hover:shadow-md border border-transparent hover:border-slate-200/60 hover:scale-102'
            }`}
            onClick={() => applyPreset('today')}
          >
            {currentPreset === 'today' && !customOpen && (
              <div className="absolute inset-0 rounded-lg bg-linear-to-r from-[#D4001A] to-[#B8001A] opacity-20 blur-sm"></div>
            )}
            <span className="relative z-10">היום</span>
          </Button>
          <Button
            variant="ghost"
            size="default"
            className={`relative px-5 py-3 text-lg font-semibold rounded-lg transition-all duration-300 transform ${
              currentPreset === 'yesterday' && !customOpen
                ? 'bg-linear-to-r from-[#D4001A] to-[#B8001A] text-white shadow-xl ring-2 ring-[#D4001A]/30 ring-offset-2 ring-offset-white scale-105 hover:shadow-2xl hover:from-[#E4002A] hover:to-[#C8002A] border border-[#D4001A]/20'
                : 'bg-white/70 text-slate-700 hover:bg-white hover:text-slate-900 hover:shadow-md border border-transparent hover:border-slate-200/60 hover:scale-102'
            }`}
            onClick={() => applyPreset('yesterday')}
          >
            {currentPreset === 'yesterday' && !customOpen && (
              <div className="absolute inset-0 rounded-lg bg-linear-to-r from-[#D4001A] to-[#B8001A] opacity-20 blur-sm"></div>
            )}
            <span className="relative z-10">אתמול</span>
          </Button>
          <Button
            variant="ghost"
            size="default"
            className={`relative px-5 py-3 text-lg font-semibold rounded-lg transition-all duration-300 transform ${
              currentPreset === 'last7' && !customOpen
                ? 'bg-linear-to-r from-[#D4001A] to-[#B8001A] text-white shadow-xl ring-2 ring-[#D4001A]/30 ring-offset-2 ring-offset-white scale-105 hover:shadow-2xl hover:from-[#E4002A] hover:to-[#C8002A] border border-[#D4001A]/20'
                : 'bg-white/70 text-slate-700 hover:bg-white hover:text-slate-900 hover:shadow-md border border-transparent hover:border-slate-200/60 hover:scale-102'
            }`}
            onClick={() => applyPreset('last7')}
          >
            {currentPreset === 'last7' && !customOpen && (
              <div className="absolute inset-0 rounded-lg bg-linear-to-r from-[#D4001A] to-[#B8001A] opacity-20 blur-sm"></div>
            )}
            <span className="relative z-10">7 ימים</span>
          </Button>
          <Button
            variant="ghost"
            size="default"
            className={`relative px-5 py-3 text-lg font-semibold rounded-lg transition-all duration-300 transform ${
              currentPreset === 'last30' && !customOpen
                ? 'bg-linear-to-r from-[#D4001A] to-[#B8001A] text-white shadow-xl ring-2 ring-[#D4001A]/30 ring-offset-2 ring-offset-white scale-105 hover:shadow-2xl hover:from-[#E4002A] hover:to-[#C8002A] border border-[#D4001A]/20'
                : 'bg-white/70 text-slate-700 hover:bg-white hover:text-slate-900 hover:shadow-md border border-transparent hover:border-slate-200/60 hover:scale-102'
            }`}
            onClick={() => applyPreset('last30')}
          >
            {currentPreset === 'last30' && !customOpen && (
              <div className="absolute inset-0 rounded-lg bg-linear-to-r from-[#D4001A] to-[#B8001A] opacity-20 blur-sm"></div>
            )}
            <span className="relative z-10">30 ימים</span>
          </Button>
          <Button
            variant="ghost"
            size="default"
            className={`relative px-5 py-3 text-lg font-semibold rounded-lg transition-all duration-300 transform ${
              currentPreset === 'custom' || customOpen
                ? 'bg-linear-to-r from-[#D4001A] to-[#B8001A] text-white shadow-xl ring-2 ring-[#D4001A]/30 ring-offset-2 ring-offset-white scale-105 hover:shadow-2xl hover:from-[#E4002A] hover:to-[#C8002A] border border-[#D4001A]/20'
                : 'bg-white/70 text-slate-700 hover:bg-white hover:text-slate-900 hover:shadow-md border border-transparent hover:border-slate-200/60 hover:scale-102'
            }`}
            onClick={() => setCustomOpen((v) => !v)}
            aria-expanded={customOpen}
          >
            {(currentPreset === 'custom' || customOpen) && (
              <div className="absolute inset-0 rounded-lg bg-linear-to-r from-[#D4001A] to-[#B8001A] opacity-20 blur-sm"></div>
            )}
            <span className="relative z-10">מותאם</span>
          </Button>
        </div>

        {/* Enhanced Current Range Display */}
        <div className="relative">
          <div className="flex flex-col gap-2 text-lg bg-linear-to-br from-white via-slate-50/80 to-slate-100/50 rounded-xl px-4 py-3 shadow-md border border-slate-200/60 backdrop-blur-sm sm:flex-row sm:items-center sm:gap-3">
            <div className="absolute inset-0 rounded-xl bg-linear-to-r from-[#D4001A]/5 to-transparent pointer-events-none"></div>
            <span className="relative z-10 font-bold text-slate-800 text-base">
              טווח נוכחי:
            </span>
            <div className="relative z-10 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
              <span className="inline-flex items-center gap-2 font-bold text-[#D4001A] text-base bg-[#D4001A]/10 px-3 py-1.5 rounded-lg border border-[#D4001A]/20">
                <div className="w-2 h-2 bg-[#D4001A] rounded-full animate-pulse"></div>
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
                  return label;
                })()}
              </span>
              <span className="text-slate-600 text-lg font-medium bg-slate-100/80 px-2.5 py-1 rounded-md border border-slate-200/60">
                ({dayjs(range.start).format('DD/MM/YYYY')} –{' '}
                {dayjs(range.end).format('DD/MM/YYYY')})
              </span>
            </div>
          </div>
        </div>
      </div>

      {customOpen && (
        <div className="relative">
          <div className="rounded-xl border border-slate-200/60 bg-linear-to-br from-white via-slate-50/80 to-slate-100/30 p-6 shadow-lg backdrop-blur-sm">
            <div className="absolute inset-0 rounded-xl bg-linear-to-r from-[#D4001A]/5 to-transparent pointer-events-none"></div>
            <div className="relative z-10 flex flex-col gap-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 bg-[#D4001A] rounded-full"></div>
                <h3 className="font-bold text-slate-800 text-lg">
                  בחירת תאריכים מותאמת
                </h3>
              </div>
              <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-end">
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
                    return toDate
                      ? dateDayjs.isAfter(dayjs(toDate), 'day')
                      : false;
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
                    return fromDate
                      ? dateDayjs.isBefore(dayjs(fromDate), 'day')
                      : false;
                  }}
                />
                <div className="flex w-full sm:w-auto sm:items-end">
                  <Button
                    size="default"
                    className="relative w-full bg-linear-to-r from-[#D4001A] to-[#B8001A] hover:from-[#E4002A] hover:to-[#C8002A] text-white disabled:opacity-50 disabled:cursor-not-allowed px-8 py-3 font-bold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 ring-2 ring-[#D4001A]/20 ring-offset-2 ring-offset-white sm:w-auto"
                    onClick={handleApply}
                    disabled={
                      !!errors.from || !!errors.to || !customFrom || !customTo
                    }
                  >
                    <span className="relative z-10">החל</span>
                    <div className="absolute inset-0 rounded-md bg-white/20 opacity-0 hover:opacity-100 transition-opacity duration-300"></div>
                  </Button>
                </div>
              </div>
              {errors.general && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  <span className="text-lg text-red-600 font-medium">
                    {errors.general}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
