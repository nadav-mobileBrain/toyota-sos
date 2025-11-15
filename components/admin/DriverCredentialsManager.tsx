'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toastError, toastSuccess } from '@/lib/toast';
import type { DriverInput } from '@/lib/schemas/driver';
import {
  DriverEditDialog,
  DriverFormSchema,
  type DriverFormValues,
  DeleteDriverDialog,
} from '@/utils/admin/drivers/dialogs';
import type { DriverRow } from '@/utils/admin/drivers/types';
import { DriverListView } from '@/utils/admin/drivers/view';

type Props = {
  initialDrivers?: DriverRow[];
};

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
  } = useForm<DriverFormValues>({
    resolver: zodResolver(DriverFormSchema),
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
    } catch (e) {
      const message = e instanceof Error ? e.message : 'שגיאה בטעינת נהגים';
      setError(message);
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
    [page, pageSize, drivers.length]
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

  const onSubmit = async (values: DriverFormValues) => {
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
          json?.error || 'מספר עובד כבר קיים, לא ניתן להשתמש באותו מספר עובד';
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
            (dialogMode === 'create' ? 'שגיאה ביצירת נהג' : 'שגיאה בעדכון נהג')
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
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : dialogMode === 'create'
          ? 'שגיאה ביצירת נהג'
          : 'שגיאה בעדכון נהג';
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
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'שגיאה במחיקת נהג';
      setError(msg);
      toastError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <DriverListView
        drivers={drivers}
        pagedDrivers={pagedDrivers}
        page={page}
        pageSize={pageSize}
        canNext={canNext}
        loading={loading}
        error={error}
        onRefresh={loadDrivers}
        onOpenCreate={openCreateDialog}
        onOpenEdit={openEditDialog}
        onPageChange={setPage}
        onStartDelete={setDeletingId}
      />

      <DriverEditDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode={dialogMode}
        submitting={submitting}
        register={register}
        errors={errors}
        onSubmit={handleSubmit(onSubmit)}
      />

      <DeleteDriverDialog
        deletingId={deletingId}
        submitting={submitting}
        onConfirm={confirmDelete}
        onOpenChange={() => setDeletingId(null)}
      />
    </>
  );
}
