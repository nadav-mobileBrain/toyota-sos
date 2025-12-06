'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toastError, toastSuccess } from '@/lib/toast';
import type { AdminInput } from '@/lib/schemas/admin';
import {
  AdminEditDialog,
  AdminFormSchema,
  type AdminFormValues,
  DeleteAdminDialog,
} from '@/utils/admin/admins/dialogs';
import type { AdminRow } from '@/utils/admin/admins/types';
import { AdminListView } from '@/utils/admin/admins/view';

type Props = {
  initialAdmins?: AdminRow[];
};

export function AdminCredentialsManager({ initialAdmins = [] }: Props) {
  const [admins, setAdmins] = useState<AdminRow[]>(initialAdmins);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [page, setPage] = useState(0);
  const pageSize = 10;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
  const [editingAdmin, setEditingAdmin] = useState<AdminRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<AdminFormValues>({
    resolver: zodResolver(AdminFormSchema),
    defaultValues: {
      name: '',
      employeeId: '',
      email: '',
      password: '',
      role: 'viewer',
    },
  });

  // Watch role to pass to Select/Dialog if needed
  const currentRole = watch('role');

  const loadAdmins = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/admins', { method: 'GET' });
      if (res.status === 401) {
        setError('לא מורשה לצפות במנהלים');
        setAdmins([]);
        return;
      }
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(txt || 'שגיאה בטעינת מנהלים');
      }
      const json = await res.json();
      const data = (json?.data as AdminRow[]) || [];
      setAdmins(data);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'שגיאה בטעינת מנהלים';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Keep initialAdmins for first paint; always refresh from API once
    if (!initialAdmins || initialAdmins.length === 0) {
      loadAdmins();
    }
  }, [initialAdmins, loadAdmins]);

  const pagedAdmins = useMemo(() => {
    const start = page * pageSize;
    const end = start + pageSize;
    return admins.slice(start, end);
  }, [admins, page, pageSize]);

  const canNext = useMemo(
    () => (page + 1) * pageSize < admins.length,
    [page, pageSize, admins.length]
  );

  const openCreateDialog = () => {
    setDialogMode('create');
    setEditingAdmin(null);
    setError(null);
    // Reset immediately before opening
    reset(
      {
        name: '',
        employeeId: '',
        email: '',
        password: '',
        role: 'viewer',
      },
      {
        keepErrors: false,
        keepDirty: false,
        keepValues: false,
        keepDefaultValues: false,
        keepIsSubmitted: false,
        keepTouched: false,
        keepIsValid: false,
        keepSubmitCount: false,
      }
    );
    setDialogOpen(true);
  };

  const openEditDialog = (admin: AdminRow) => {
    setDialogMode('edit');
    setEditingAdmin(admin);
    reset({
      name: admin.name ?? '',
      employeeId: admin.employee_id ?? '',
      email: admin.email ?? '',
      password: '', // Don't populate password on edit
      role: admin.role,
    });
    setError(null);
    setDialogOpen(true);
  };

  const onSubmit = async (values: AdminFormValues) => {
    setSubmitting(true);
    setError(null);
    try {
      const payload: AdminInput = {
        name: values.name.trim(),
        employeeId: values.employeeId?.trim() || undefined,
        email: values.email,
        password: values.password,
        role: values.role,
      };

      let res: Response;
      if (dialogMode === 'create') {
        res = await fetch('/api/admin/admins', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        if (!editingAdmin) {
          throw new Error('לא נמצא מנהל לעריכה');
        }
        res = await fetch(`/api/admin/admins/${editingAdmin.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      if (res.status === 401) {
        const msg =
          dialogMode === 'create'
            ? 'אין הרשאה ליצור מנהל חדש'
            : 'אין הרשאה לעדכן מנהל';
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
            (dialogMode === 'create'
              ? 'שגיאה ביצירת מנהל'
              : 'שגיאה בעדכון מנהל')
        );
      }

      const successMsg =
        dialogMode === 'create' ? 'מנהל נוצר בהצלחה' : 'מנהל עודכן בהצלחה';
      toastSuccess(successMsg);

      reset({
        name: '',
        employeeId: '',
        email: '',
        password: '',
        role: 'viewer',
      });
      setDialogOpen(false);
      setPage(0);
      await loadAdmins();
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : dialogMode === 'create'
          ? 'שגיאה ביצירת מנהל'
          : 'שגיאה בעדכון מנהל';
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
      const res = await fetch(`/api/admin/admins/${deletingId}`, {
        method: 'DELETE',
      });
      if (res.status === 401) {
        const msg = 'אין הרשאה למחוק מנהל';
        setError(msg);
        toastError(msg);
        return;
      }
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        const msg = json?.error || 'שגיאה במחיקת מנהל';
        setError(msg);
        toastError(msg);
        return;
      }
      toastSuccess('מנהל נמחק בהצלחה');
      setDeletingId(null);
      await loadAdmins();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'שגיאה במחיקת מנהל';
      setError(msg);
      toastError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <AdminListView
        admins={admins}
        pagedAdmins={pagedAdmins}
        page={page}
        pageSize={pageSize}
        canNext={canNext}
        loading={loading}
        error={error}
        onRefresh={loadAdmins}
        onOpenCreate={openCreateDialog}
        onOpenEdit={openEditDialog}
        onPageChange={setPage}
        onStartDelete={setDeletingId}
      />

      {dialogOpen && (
        <AdminEditDialog
          open={dialogOpen}
          onOpenChange={(open) => {
            if (!open) {
              // Reset form when dialog closes
              reset(
                {
                  name: '',
                  employeeId: '',
                  email: '',
                  password: '',
                  role: 'viewer',
                },
                {
                  keepErrors: false,
                  keepDirty: false,
                  keepValues: false,
                  keepDefaultValues: false,
                }
              );
              setEditingAdmin(null);
              setError(null);
            }
            setDialogOpen(open);
          }}
          mode={dialogMode}
          submitting={submitting}
          register={register}
          setValue={setValue}
          errors={errors}
          onSubmit={handleSubmit(onSubmit)}
          defaultRole={currentRole}
        />
      )}

      <DeleteAdminDialog
        deletingId={deletingId}
        submitting={submitting}
        onConfirm={confirmDelete}
        onOpenChange={() => setDeletingId(null)}
      />
    </>
  );
}
