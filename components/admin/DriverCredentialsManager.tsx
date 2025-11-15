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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toastError, toastSuccess } from '@/lib/toast';

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
  const [submitting, setSubmitting] = useState(false);
  const [page, setPage] = useState(0);
  const pageSize = 10;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
  const [editingDriver, setEditingDriver] = useState<DriverRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  const openCreateDialog = () => {
    setDialogMode('create');
    setEditingDriver(null);
    reset({
      name: '',
      employeeId: '',
      email: '',
    });
    setError(null);
    setDialogOpen(true);
  };

  const openEditDialog = (driver: DriverRow) => {
    setDialogMode('edit');
    setEditingDriver(driver);
    reset({
      name: driver.name ?? '',
      employeeId: driver.employee_id ?? '',
      email: driver.email ?? '',
    });
    setError(null);
    setDialogOpen(true);
  };

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    setError(null);
    try {
      const payload: DriverInput = {
        name: values.name.trim(),
        employeeId: values.employeeId.trim(),
        email: values.email,
      };

      let res: Response;
      if (dialogMode === 'create') {
        res = await fetch('/api/admin/drivers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        if (!editingDriver) {
          throw new Error('לא נמצא נהג לעריכה');
        }
        res = await fetch(`/api/admin/drivers/${editingDriver.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      if (res.status === 401) {
        const msg =
          dialogMode === 'create'
            ? 'אין הרשאה ליצור נהג חדש'
            : 'אין הרשאה לעדכן נהג';
        setError(msg);
        toastError(msg);
        return;
      }

      if (res.status === 409) {
        const json = await res.json().catch(() => ({}));
        const msg =
          json?.error ||
          'מספר עובד כבר קיים, לא ניתן להשתמש באותו מספר עובד';
        setError(msg);
        toastError(msg);
        return;
      }

      if (res.status === 400) {
        const json = await res.json().catch(() => ({}));
        const msg = json?.error || 'נתונים לא תקינים';
        setError(msg);
        toastError(msg);
        return;
      }

      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(
          txt ||
            (dialogMode === 'create'
              ? 'שגיאה ביצירת נהג'
              : 'שגיאה בעדכון נהג'),
        );
      }

      const successMsg =
        dialogMode === 'create' ? 'נהג נוצר בהצלחה' : 'נהג עודכן בהצלחה';
      toastSuccess(successMsg);

      reset({
        name: '',
        employeeId: '',
        email: '',
      });
      setDialogOpen(false);
      setPage(0);
      await loadDrivers();
    } catch (e: any) {
      const msg =
        e?.message ||
        (dialogMode === 'create'
          ? 'שגיאה ביצירת נהג'
          : 'שגיאה בעדכון נהג');
      setError(msg);
      toastError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deletingId) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/drivers/${deletingId}`, {
        method: 'DELETE',
      });
      if (res.status === 401) {
        const msg = 'אין הרשאה למחוק נהג';
        setError(msg);
        toastError(msg);
        return;
      }
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        const msg = json?.error || 'שגיאה במחיקת נהג';
        setError(msg);
        toastError(msg);
        return;
      }
      toastSuccess('נהג נמחק בהצלחה');
      setDeletingId(null);
      await loadDrivers();
    } catch (e: any) {
      const msg = e?.message || 'שגיאה במחיקת נהג';
      setError(msg);
      toastError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section
      dir="rtl"
      className="mt-4 space-y-4"
      aria-label="ניהול פרטי הנהגים"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">כל הנהגים</h2>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={loadDrivers}
            disabled={loading}
          >
            רענן
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={openCreateDialog}
          >
            הוסף נהג חדש
          </Button>
        </div>
      </div>
      <div className="space-y-3">
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
                          onClick={() => openEditDialog(d)}
                        >
                          ערוך
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-[11px]"
                          onClick={() => setDeletingId(d.id)}
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

      <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {dialogMode === 'create' ? 'יצירת נהג חדש' : 'עריכת נהג'}
            </AlertDialogTitle>
          </AlertDialogHeader>
          <form
            className="mt-3 space-y-4"
            onSubmit={handleSubmit(onSubmit)}
          >
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
                placeholder="לדוגמה: 1234"
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
            <AlertDialogFooter>
              <AlertDialogAction
                type="submit"
                className="bg-toyota-primary hover:bg-toyota-primary/90"
                disabled={submitting}
              >
                {dialogMode === 'create'
                  ? submitting
                    ? 'יוצר נהג...'
                    : 'צור נהג'
                  : submitting
                    ? 'מעדכן נהג...'
                    : 'עדכן נהג'}
              </AlertDialogAction>
              <AlertDialogCancel type="button" disabled={submitting}>
                ביטול
              </AlertDialogCancel>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>מחיקת נהג</AlertDialogTitle>
          </AlertDialogHeader>
          <p className="mt-2 text-xs text-gray-700">
            האם אתה בטוח שברצונך למחוק את הנהג? פעולה זו אינה הפיכה ועלולה להסיר
            שיוכים למשימות.
          </p>
          <AlertDialogFooter>
            <AlertDialogAction
              type="button"
              className="bg-red-600 hover:bg-red-700"
              disabled={submitting}
              onClick={confirmDelete}
            >
              מחק
            </AlertDialogAction>
            <AlertDialogCancel type="button" disabled={submitting}>
              ביטול
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}


