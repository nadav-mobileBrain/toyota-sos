'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toastError, toastSuccess } from '@/lib/toast';
import type { VehicleInput } from '@/lib/schemas/vehicle';
import {
  VehicleEditDialog,
  VehicleFormSchema,
  type VehicleFormValues,
  DeleteVehicleDialog,
} from '@/utils/admin/vehicles/dialogs';
import type { VehicleRow } from '@/utils/admin/vehicles/types';
import { VehicleListView } from '@/utils/admin/vehicles/view';

type Props = {
  initialVehicles?: VehicleRow[];
};

export function VehicleCredentialsManager({
  initialVehicles = [],
}: Props) {
  const [vehicles, setVehicles] = useState<VehicleRow[]>(initialVehicles);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [page, setPage] = useState(0);
  const pageSize = 10;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
  const [editingVehicle, setEditingVehicle] = useState<VehicleRow | null>(
    null
  );
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isAvailable, setIsAvailable] = useState(true);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<VehicleFormValues>({
    resolver: zodResolver(VehicleFormSchema),
    defaultValues: {
      license_plate: '',
      model: '',
      is_available: true,
      unavailability_reason: null,
    },
  });

  const watchedIsAvailable = watch('is_available', true);

  useEffect(() => {
    setIsAvailable(watchedIsAvailable);
  }, [watchedIsAvailable]);

  const loadVehicles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/vehicles', { method: 'GET' });
      if (res.status === 401) {
        setError('לא מורשה לצפות ברכבים');
        setVehicles([]);
        return;
      }
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(txt || 'שגיאה בטעינת רכבים');
      }
      const json = await res.json();
      const data = (json?.data as VehicleRow[]) || [];
      setVehicles(data);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'שגיאה בטעינת רכבים';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initialVehicles || initialVehicles.length === 0) {
      loadVehicles();
    }
  }, [initialVehicles, loadVehicles]);

  const pagedVehicles = useMemo(() => {
    const start = page * pageSize;
    const end = start + pageSize;
    return vehicles.slice(start, end);
  }, [vehicles, page, pageSize]);

  const canNext = useMemo(
    () => (page + 1) * pageSize < vehicles.length,
    [page, pageSize, vehicles.length]
  );

  const openCreateDialog = () => {
    setDialogMode('create');
    setEditingVehicle(null);
    setIsAvailable(true);
    reset({
      license_plate: '',
      model: '',
      is_available: true,
      unavailability_reason: null,
    });
    setError(null);
    setDialogOpen(true);
  };

  const openEditDialog = (vehicle: VehicleRow) => {
    setDialogMode('edit');
    setEditingVehicle(vehicle);
    setIsAvailable(vehicle.is_available);
    reset({
      license_plate: vehicle.license_plate,
      model: vehicle.model ?? '',
      is_available: vehicle.is_available,
      unavailability_reason: vehicle.unavailability_reason ?? null,
    });
    setError(null);
    setDialogOpen(true);
  };

  const onSubmit = async (values: VehicleFormValues) => {
    setSubmitting(true);
    setError(null);
    try {
      const payload: VehicleInput = {
        license_plate: values.license_plate.trim(),
        model: values.model,
        is_available: values.is_available,
        unavailability_reason: values.is_available
          ? null
          : values.unavailability_reason,
      };

      let res: Response;
      if (dialogMode === 'create') {
        res = await fetch('/api/admin/vehicles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        if (!editingVehicle) {
          throw new Error('לא נמצא רכב לעריכה');
        }
        res = await fetch(`/api/admin/vehicles/${editingVehicle.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      if (res.status === 401) {
        const msg =
          dialogMode === 'create'
            ? 'אין הרשאה ליצור רכב חדש'
            : 'אין הרשאה לעדכן רכב';
        setError(msg);
        toastError(msg);
        return;
      }

      if (res.status === 409) {
        const json = await res.json().catch(() => ({}));
        const msg =
          json?.error || 'מספר רישוי כבר קיים במערכת';
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
            (dialogMode === 'create' ? 'שגיאה ביצירת רכב' : 'שגיאה בעדכון רכב')
        );
      }

      const successMsg =
        dialogMode === 'create' ? 'רכב נוצר בהצלחה' : 'רכב עודכן בהצלחה';
      toastSuccess(successMsg);

      reset({
        license_plate: '',
        model: '',
        is_available: true,
        unavailability_reason: null,
      });
      setDialogOpen(false);
      setPage(0);
      await loadVehicles();
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : dialogMode === 'create'
          ? 'שגיאה ביצירת רכב'
          : 'שגיאה בעדכון רכב';
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
      const res = await fetch(`/api/admin/vehicles/${deletingId}`, {
        method: 'DELETE',
      });
      if (res.status === 401) {
        const msg = 'אין הרשאה למחוק רכב';
        setError(msg);
        toastError(msg);
        return;
      }
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        const msg = json?.error || 'שגיאה במחיקת רכב';
        setError(msg);
        toastError(msg);
        return;
      }
      toastSuccess('רכב נמחק בהצלחה');
      setDeletingId(null);
      await loadVehicles();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'שגיאה במחיקת רכב';
      setError(msg);
      toastError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <VehicleListView
        vehicles={vehicles}
        pagedVehicles={pagedVehicles}
        page={page}
        pageSize={pageSize}
        canNext={canNext}
        loading={loading}
        error={error}
        onRefresh={loadVehicles}
        onOpenCreate={openCreateDialog}
        onOpenEdit={openEditDialog}
        onPageChange={setPage}
        onStartDelete={setDeletingId}
      />

      <VehicleEditDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode={dialogMode}
        submitting={submitting}
        register={register}
        errors={errors}
        onSubmit={handleSubmit(onSubmit)}
        isAvailable={isAvailable}
        onAvailabilityChange={(checked) => {
          setIsAvailable(checked);
          setValue('is_available', checked);
          if (checked) {
            setValue('unavailability_reason', null);
          }
        }}
      />

      <DeleteVehicleDialog
        deletingId={deletingId}
        submitting={submitting}
        onConfirm={confirmDelete}
        onOpenChange={() => setDeletingId(null)}
      />
    </>
  );
}

