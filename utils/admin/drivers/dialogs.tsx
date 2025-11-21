'use client';

import React from 'react';
import type { FieldErrors, UseFormRegister } from 'react-hook-form';
import { z } from 'zod';
import { driverSchema } from '@/lib/schemas/driver';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

// ---- Form schema & types ----

export const DriverFormSchema = driverSchema.extend({
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

export type DriverFormValues = z.infer<typeof DriverFormSchema>;

export function formatDriverTimestamp(ts: string | null) {
  if (!ts) return '—';
  try {
    return dayjs(ts).format('DD/MM/YYYY HH:mm');
  } catch {
    return ts as string;
  }
}

// ---- Create / Edit dialog ----

export type DriverDialogMode = 'create' | 'edit';

type DriverEditDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: DriverDialogMode;
  submitting: boolean;
  register: UseFormRegister<DriverFormValues>;
  errors: FieldErrors<DriverFormValues>;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
};

export function DriverEditDialog({
  open,
  onOpenChange,
  mode,
  submitting,
  register,
  errors,
  onSubmit,
}: DriverEditDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {mode === 'create' ? 'יצירת נהג חדש' : 'עריכת נהג'}
          </AlertDialogTitle>
        </AlertDialogHeader>
        <form className="mt-3 space-y-4" onSubmit={onSubmit}>
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
          {/* <div className="space-y-1.5">
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
          </div> */}
          <AlertDialogFooter>
            <Button
              type="submit"
              className="bg-toyota-primary hover:bg-toyota-primary/90"
              disabled={submitting}
            >
              {mode === 'create'
                ? submitting
                  ? 'יוצר נהג...'
                  : 'צור נהג'
                : submitting
                ? 'מעדכן נהג...'
                : 'עדכן נהג'}
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

type DeleteDriverDialogProps = {
  deletingId: string | null;
  submitting: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
};

export function DeleteDriverDialog({
  deletingId,
  submitting,
  onConfirm,
  onOpenChange,
}: DeleteDriverDialogProps) {
  return (
    <AlertDialog
      open={!!deletingId}
      onOpenChange={(open) => !open && onOpenChange(open)}
    >
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
