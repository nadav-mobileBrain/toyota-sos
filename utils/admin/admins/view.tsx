'use client';

import { Button } from '@/components/ui/button';
import type { AdminRow, AdminRole } from '@/utils/admin/admins/types';
import { formatAdminTimestamp } from '@/utils/admin/admins/dialogs';
import { PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

type AdminListViewProps = {
  admins: AdminRow[];
  pagedAdmins: AdminRow[];
  page: number;
  pageSize: number;
  canNext: boolean;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onOpenCreate: () => void;
  onOpenEdit: (admin: AdminRow) => void;
  onPageChange: (page: number) => void;
  onStartDelete: (id: string) => void;
};

const roleLabels: Record<AdminRole, string> = {
  admin: 'מנהל מערכת',
  manager: 'מנהל משימות',
  viewer: 'צופה',
};

const roleColors: Record<AdminRole, string> = {
  admin: 'bg-red-100 text-red-800 border-red-200',
  manager: 'bg-blue-100 text-blue-800 border-blue-200',
  viewer: 'bg-gray-100 text-gray-800 border-gray-200',
};

export function AdminListView({
  admins,
  pagedAdmins,
  page,
  pageSize,
  canNext,
  loading,
  error,
  // onRefresh,
  onOpenCreate,
  onOpenEdit,
  onPageChange,
  onStartDelete,
}: AdminListViewProps) {
  return (
    <section
      dir="rtl"
      className="mt-4 space-y-4 container mx-auto max-w-5xl"
      aria-label="ניהול מנהלים"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            onClick={onOpenCreate}
            className="bg-primary text-white hover:bg-primary/80"
          >
            <PlusIcon className="w-4 h-4" />
            הוסף מנהל חדש
          </Button>
        </div>
      </div>
      <div className="space-y-3">
        {loading ? <div className="text-sm">טוען מנהלים...</div> : null}
        {error ? (
          <div
            role="alert"
            className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700"
          >
            {error}
          </div>
        ) : null}
        <div className="overflow-x-auto rounded border bg-white ">
          <table className="min-w-full text-sm rtl:text-right">
            <thead className="bg-gray-50">
              <tr className="text-xs font-semibold text-gray-600">
                <th className="px-3 py-2 text-right">שם</th>
                <th className="px-3 py-2 text-right">מספר עובד</th>
                <th className="px-3 py-2 text-right">אימייל</th>
                <th className="px-3 py-2 text-right">תפקיד</th>
                <th className="px-3 py-2 text-right">נוצר</th>
                <th className="px-3 py-2 text-right">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {pagedAdmins.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-3 py-4 text-center text-xs text-gray-500"
                  >
                    אין מנהלים להצגה.
                  </td>
                </tr>
              ) : (
                pagedAdmins.map((d) => (
                  <tr key={d.id} className="border-t text-xs">
                    <td className="px-3 py-2">{d.name || '—'}</td>
                    <td className="px-3 py-2 font-mono">
                      {d.employee_id || '—'}
                    </td>
                    <td className="px-3 py-2">{d.email || '—'}</td>
                    <td className="px-3 py-2">
                      <Badge
                        variant="outline"
                        className={roleColors[d.role] || ''}
                      >
                        {roleLabels[d.role] || d.role}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      {formatAdminTimestamp(d.created_at)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-[11px]"
                          onClick={() => onOpenEdit(d)}
                        >
                          <PencilIcon className="w-4 h-4 text-blue-500 hover:text-blue-600" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-[11px]"
                          onClick={() => onStartDelete(d.id)}
                        >
                          <Trash2Icon className="w-4 h-4 text-red-500 hover:text-red-600" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {admins.length > pageSize ? (
          <div className="flex items-center justify-between text-xs">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onPageChange(Math.max(0, page - 1))}
              disabled={page === 0}
            >
              קודם
            </Button>
            <span>
              עמוד {page + 1} מתוך{' '}
              {Math.max(1, Math.ceil(admins.length / pageSize))}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onPageChange(canNext ? page + 1 : page)}
              disabled={!canNext}
            >
              הבא
            </Button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

