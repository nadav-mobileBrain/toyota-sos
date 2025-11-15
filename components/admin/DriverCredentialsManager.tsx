'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import dayjs from '@/lib/dayjs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { DriverInput } from '@/lib/schemas/driver';
import { driverSchema } from '@/lib/schemas/driver';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

type DriverRow = {
  id: string;
  name: string | null;
  email: string | null;
  employee_id: string | null;
  role: 'driver' | 'admin' | 'manager' | 'viewer';
  created_at: string;
  updated_at: string;
};

type Props = {
  initialDrivers?: DriverRow[];
};

const FormSchema = driverSchema.extend({
  // Accept empty string for email and coerce to optional
  email: z
    .union([z.string().email('אימייל לא תקין').max(255), z.literal('')])
    .optional()
    .transform((val) => {
      if (!val) return undefined;
      const trimmed = val.trim();
      return trimmed.length === 0 ? undefined : trimmed;
    }),
});

type FormValues = z.infer<typeof FormSchema>;

function formatTimestamp(ts: string | null) {
  if (!ts) return '—';
  try {
    return dayjs(ts).format('DD/MM/YYYY HH:mm');
  } catch {
    return ts;
  }
}

export function DriverCredentialsManager({ initialDrivers = [] }: Props) {
  const [drivers, setDrivers] = useState<DriverRow[]>(initialDrivers);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [page, setPage] = useState(0);
  const pageSize = 10;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      name: '',
      employeeId: '',
      email: '',
    },
  });

  const loadDrivers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/drivers', { method: 'GET' });
      if (res.status === 401) {
        setError('לא מורשה לצפות בנהגים');
        setDrivers([]);
        return;
      }
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(txt || 'שגיאה בטעינת נהגים');
      }
      const json = await res.json();
      const data = (json?.data as DriverRow[]) || [];
      setDrivers(data);
    } catch (e: any) {
      setError(e?.message || 'שגיאה בטעינת נהגים');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Keep initialDrivers for first paint; always refresh from API once
    if (!initialDrivers || initialDrivers.length === 0) {
      loadDrivers();
    }
  }, [initialDrivers, loadDrivers]);

  const pagedDrivers = useMemo(() => {
    const start = page * pageSize;
    const end = start + pageSize;
    return drivers.slice(start, end);
  }, [drivers, page, pageSize]);

  const canNext = useMemo(
    () => (page + 1) * pageSize < drivers.length,
    [page, pageSize, drivers.length],
  );

  const onSubmit = async (values: FormValues) => {
    setCreating(true);
    setError(null);
    try {
      const payload: DriverInput = {
        name: values.name.trim(),
        employeeId: values.employeeId.trim(),
        email: values.email,
      };

      const res = await fetch('/api/admin/drivers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.status === 401) {
        setError('אין הרשאה ליצור נהג חדש');
        return;
      }

      if (res.status === 409) {
        const json = await res.json().catch(() => ({}));
        setError(
          json?.error || 'מספר עובד כבר קיים, לא ניתן ליצור נהג עם אותו מספר עובד',
        );
        return;
      }

      if (res.status === 400) {
        const json = await res.json().catch(() => ({}));
        const msg = json?.error || 'נתונים לא תקינים';
        setError(msg);
        return;
      }

      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(txt || 'שגיאה ביצירת נהג');
      }

      reset({
        name: '',
        employeeId: '',
        email: '',
      });
      setPage(0);
      await loadDrivers();
    } catch (e: any) {
      setError(e?.message || 'שגיאה ביצירת נהג');
    } finally {
      setCreating(false);
    }
  };

  return (
    <section
      dir="rtl"
      className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)]"
      aria-label="ניהול פרטי הנהגים"
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">כל הנהגים</h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={loadDrivers}
            disabled={loading}
          >
            רענן
          </Button>
        </div>
        {loading ? <div className="text-sm">טוען נהגים...</div> : null}
        {error ? (
          <div role="alert" className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}
        <div className="overflow-x-auto rounded border bg-white">
          <table className="min-w-full text-sm rtl:text-right">
            <thead className="bg-gray-50">
              <tr className="text-xs font-semibold text-gray-600">
                <th className="px-3 py-2 text-right">שם</th>
                <th className="px-3 py-2 text-right">מספר עובד</th>
                <th className="px-3 py-2 text-right">אימייל</th>
                <th className="px-3 py-2 text-right">נוצר</th>
                <th className="px-3 py-2 text-right">עודכן</th>
                <th className="px-3 py-2 text-right">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {pagedDrivers.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-4 text-center text-xs text-gray-500"
                  >
                    אין נהגים להצגה.
                  </td>
                </tr>
              ) : (
                pagedDrivers.map((d) => (
                  <tr key={d.id} className="border-t text-xs">
                    <td className="px-3 py-2">{d.name || '—'}</td>
                    <td className="px-3 py-2 font-mono">
                      {d.employee_id || '—'}
                    </td>
                    <td className="px-3 py-2 break-all">
                      {d.email || '—'}
                    </td>
                    <td className="px-3 py-2">
                      {formatTimestamp(d.created_at)}
                    </td>
                    <td className="px-3 py-2">
                      {formatTimestamp(d.updated_at)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-[11px]"
                          disabled
                          aria-disabled="true"
                          title="עריכה תתווסף בהמשך"
                        >
                          ערוך
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-[11px]"
                          disabled
                          aria-disabled="true"
                          title="מחיקה תתווסף בהמשך"
                        >
                          מחק
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {drivers.length > pageSize ? (
          <div className="flex items-center justify-between text-xs">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              קודם
            </Button>
            <span>
              עמוד {page + 1} מתוך {Math.max(1, Math.ceil(drivers.length / pageSize))}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => (canNext ? p + 1 : p))}
              disabled={!canNext}
            >
              הבא
            </Button>
          </div>
        ) : null}
      </div>

      <div className="space-y-3 rounded border bg-white p-4">
        <h2 className="text-lg font-semibold">יצירת נהג חדש</h2>
        <p className="text-xs text-gray-600">
          טופס זה יוצר משתמש נהג חדש ומקצה לו מספר עובד ייחודי. סיסמת ברירת מחדל
          נגזרת ממספר העובד, והכניסה בפועל מתבצעת לפי מספר עובד בלבד.
        </p>
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-1.5">
            <Label htmlFor="driver-name">שם הנהג</Label>
            <Input
              id="driver-name"
              placeholder="שם מלא"
              {...register('name')}
            />
            {errors.name ? (
              <p className="text-xs text-red-600">{errors.name.message}</p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="driver-employee-id">מספר עובד</Label>
            <Input
              id="driver-employee-id"
              placeholder="לדוגמה: D0006 או 12345"
              {...register('employeeId')}
            />
            {errors.employeeId ? (
              <p className="text-xs text-red-600">
                {errors.employeeId.message}
              </p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="driver-email">
              אימייל (אופציונלי עבור ניהול מתקדם)
            </Label>
            <Input
              id="driver-email"
              type="email"
              placeholder="example@toyota.co.il"
              {...register('email')}
            />
            {errors.email ? (
              <p className="text-xs text-red-600">{errors.email.message}</p>
            ) : null}
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={creating}
          >
            {creating ? 'יוצר נהג...' : 'צור נהג'}
          </Button>
        </form>
      </div>
    </section>
  );
}


