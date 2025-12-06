'use client';

import React from 'react';
import type {
  FieldErrors,
  UseFormRegister,
  UseFormSetValue,
} from 'react-hook-form';
import { z } from 'zod';
import { adminSchema } from '@/lib/schemas/admin';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import dayjs from '@/lib/dayjs';
import { PlusIcon } from 'lucide-react';

// ---- Form schema & types ----

export const AdminFormSchema = adminSchema.refine(
  () => {
    // Password is required only in create mode (we'll handle this at form level)
    return true;
  },
  {
    message: 'סיסמה היא שדה חובה',
    path: ['password'],
  }
);

export type AdminFormValues = z.infer<typeof AdminFormSchema>;

export function formatAdminTimestamp(ts: string | null) {
  if (!ts) return '—';
  try {
    return dayjs(ts).format('DD/MM/YYYY HH:mm');
  } catch {
    return ts as string;
  }
}

// ---- Create / Edit dialog ----

export type AdminDialogMode = 'create' | 'edit';

type AdminEditDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: AdminDialogMode;
  submitting: boolean;
  register: UseFormRegister<AdminFormValues>;
  setValue: UseFormSetValue<AdminFormValues>;
  errors: FieldErrors<AdminFormValues>;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  defaultRole?: string;
};

export function AdminEditDialog({
  open,
  onOpenChange,
  mode,
  submitting,
  register,
  setValue,
  errors,
  onSubmit,
  defaultRole = 'viewer',
}: AdminEditDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent key={`${mode}-${open}`}>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {mode === 'create' ? 'יצירת מנהל חדש' : 'עריכת מנהל'}
          </AlertDialogTitle>
        </AlertDialogHeader>
        <form className="mt-3 space-y-4" onSubmit={onSubmit} autoComplete="off">
          <div className="space-y-1.5">
            <Label htmlFor="admin-name">שם מלא</Label>
            <Input
              id="admin-name"
              placeholder="שם מלא"
              autoComplete="off"
              {...register('name')}
            />
            {errors.name ? (
              <p className="text-xs text-red-600">{errors.name.message}</p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="admin-email">אימייל *</Label>
            <Input
              id="admin-email"
              type="email"
              placeholder="example@toyota.co.il"
              autoComplete="off"
              {...register('email')}
              required
            />
            {errors.email ? (
              <p className="text-xs text-red-600">{errors.email.message}</p>
            ) : null}
          </div>
          {mode === 'create' && (
            <div className="space-y-1.5">
              <Label htmlFor="admin-password">סיסמה *</Label>
              <Input
                id="admin-password"
                type="password"
                placeholder="לפחות 6 תווים"
                autoComplete="new-password"
                {...register('password')}
                required
              />
              {errors.password ? (
                <p className="text-xs text-red-600">
                  {errors.password.message}
                </p>
              ) : null}
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="admin-employee-id">מספר עובד (אופציונלי)</Label>
            <Input
              id="admin-employee-id"
              placeholder="לדוגמה: 1234"
              autoComplete="off"
              {...register('employeeId')}
            />
            {errors.employeeId ? (
              <p className="text-xs text-red-600">
                {errors.employeeId.message}
              </p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="admin-role">תפקיד</Label>
            <Select
              key={`${mode}-${defaultRole}`}
              onValueChange={(val) =>
                setValue('role', val as 'admin' | 'manager' | 'viewer')
              }
              value={defaultRole}
            >
              <SelectTrigger>
                <SelectValue placeholder="בחר תפקיד" />
              </SelectTrigger>
              <SelectContent
                position="popper"
                sideOffset={4}
                className="bg-white"
              >
                <SelectItem value="viewer">צופה (Viewer)</SelectItem>
                <SelectItem value="manager">מנהל משימות (Manager)</SelectItem>
                <SelectItem value="admin">מנהל מערכת (Admin)</SelectItem>
              </SelectContent>
            </Select>
            {errors.role ? (
              <p className="text-xs text-red-600">{errors.role.message}</p>
            ) : null}
          </div>
          <AlertDialogFooter>
            <Button
              type="submit"
              className="bg-primary hover:bg-primary/90 text-white"
              disabled={submitting}
            >
              <PlusIcon className="w-4 h-4" />
              {mode === 'create'
                ? submitting
                  ? 'יוצר...'
                  : 'צור מנהל'
                : submitting
                ? 'מעדכן...'
                : 'עדכן מנהל'}
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

type DeleteAdminDialogProps = {
  deletingId: string | null;
  submitting: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
};

export function DeleteAdminDialog({
  deletingId,
  submitting,
  onConfirm,
  onOpenChange,
}: DeleteAdminDialogProps) {
  return (
    <AlertDialog
      open={!!deletingId}
      onOpenChange={(open) => !open && onOpenChange(open)}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>מחיקת מנהל</AlertDialogTitle>
        </AlertDialogHeader>
        <p className="mt-2 text-xs text-gray-700">
          האם אתה בטוח שברצונך למחוק את המנהל? פעולה זו אינה הפיכה.
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
