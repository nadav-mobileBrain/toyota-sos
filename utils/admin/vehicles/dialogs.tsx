'use client';

import React from 'react';
import type { FieldErrors, UseFormRegister } from 'react-hook-form';
import { z } from 'zod';
import { vehicleSchema } from '@/lib/schemas/vehicle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import dayjs from '@/lib/dayjs';
import { CarIcon } from 'lucide-react';

// ---- Form schema & types ----

export const VehicleFormSchema = vehicleSchema.extend({
  model: z
    .union([
      z.string().trim().max(100, 'מודל לא יכול להכיל יותר מ-100 תווים'),
      z.literal(''),
      z.undefined(),
    ])
    .transform((val) => {
      if (!val || val.trim().length === 0) return undefined;
      return val.trim();
    }),
  unavailability_reason: z
    .union([
      z
        .string()
        .trim()
        .max(500, 'סיבת אי זמינות לא יכולה להכיל יותר מ-500 תווים'),
      z.literal(''),
      z.undefined(),
    ])
    .transform((val) => {
      if (!val || val.trim().length === 0) return null;
      return val.trim();
    })
    .nullable(),
});

export type VehicleFormValues = z.infer<typeof VehicleFormSchema>;

export function formatVehicleTimestamp(ts: string | null) {
  if (!ts) return '—';
  try {
    return dayjs(ts).format('DD/MM/YYYY HH:mm');
  } catch {
    return ts as string;
  }
}

// ---- Create / Edit dialog ----

export type VehicleDialogMode = 'create' | 'edit';

type VehicleEditDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: VehicleDialogMode;
  submitting: boolean;
  register: UseFormRegister<VehicleFormValues>;
  errors: FieldErrors<VehicleFormValues>;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  isAvailable: boolean;
  onAvailabilityChange: (checked: boolean) => void;
};

export function VehicleEditDialog({
  open,
  onOpenChange,
  mode,
  submitting,
  register,
  errors,
  onSubmit,
  isAvailable,
  onAvailabilityChange,
}: VehicleEditDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {mode === 'create' ? 'יצירת רכב חדש' : 'עריכת רכב'}
          </AlertDialogTitle>
        </AlertDialogHeader>
        <form className="mt-3 space-y-4" onSubmit={onSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="vehicle-license-plate">מספר רישוי *</Label>
            <Input
              id="vehicle-license-plate"
              placeholder="לדוגמה: 12-345-67"
              {...register('license_plate')}
            />
            {errors.license_plate ? (
              <p className="text-xs text-red-600">
                {errors.license_plate.message}
              </p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vehicle-model">מודל</Label>
            <Input
              id="vehicle-model"
              placeholder="לדוגמה: Corolla"
              {...register('model')}
            />
            {errors.model ? (
              <p className="text-xs text-red-600">{errors.model.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="vehicle-is-available"
                checked={isAvailable}
                onCheckedChange={(checked) =>
                  onAvailabilityChange(checked === true)
                }
              />
              <Label
                htmlFor="vehicle-is-available"
                className="text-sm font-medium cursor-pointer"
              >
                רכב זמין
              </Label>
            </div>
            <input
              type="hidden"
              {...register('is_available', { value: isAvailable })}
            />
            {!isAvailable && (
              <div className="space-y-1.5 mr-6">
                <Label htmlFor="vehicle-unavailability-reason">
                  סיבת אי זמינות
                </Label>
                <Input
                  id="vehicle-unavailability-reason"
                  placeholder="לדוגמה: תקלה, לא נמצא בסוכנות"
                  {...register('unavailability_reason')}
                />
                {errors.unavailability_reason ? (
                  <p className="text-xs text-red-600">
                    {errors.unavailability_reason.message}
                  </p>
                ) : null}
              </div>
            )}
          </div>
          <AlertDialogFooter>
            <Button
              type="submit"
              className="bg-primary hover:bg-primary/90 text-white"
              disabled={submitting}
            >
              <CarIcon className="w-4 h-4" />
              {mode === 'create'
                ? submitting
                  ? 'יוצר רכב...'
                  : 'צור רכב'
                : submitting
                ? 'מעדכן רכב...'
                : 'עדכן רכב'}
            </Button>
            <AlertDialogCancel type="button" disabled={submitting}>
              ביטול
            </AlertDialogCancel>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ---- Delete confirmation dialog ----

type DeleteVehicleDialogProps = {
  deletingId: string | null;
  submitting: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
};

export function DeleteVehicleDialog({
  deletingId,
  submitting,
  onConfirm,
  onOpenChange,
}: DeleteVehicleDialogProps) {
  return (
    <AlertDialog
      open={!!deletingId}
      onOpenChange={(open) => !open && onOpenChange(open)}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>מחיקת רכב</AlertDialogTitle>
        </AlertDialogHeader>
        <p className="mt-2 text-xs text-gray-700">
          האם אתה בטוח שברצונך למחוק את הרכב? פעולה זו אינה הפיכה ועלולה להסיר
          שיוכים למשימות.
        </p>
        <AlertDialogFooter>
          <AlertDialogAction
            type="button"
            className="bg-red-600 hover:bg-red-700"
            disabled={submitting}
            onClick={onConfirm}
          >
            מחק
          </AlertDialogAction>
          <AlertDialogCancel type="button" disabled={submitting}>
            ביטול
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
