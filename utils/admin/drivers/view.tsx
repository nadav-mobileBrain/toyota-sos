'use client';

import { Button } from '@/components/ui/button';
import type { DriverRow } from '@/utils/admin/drivers/types';
import { formatDriverTimestamp } from '@/utils/admin/drivers/dialogs';
import { PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react';

type DriverListViewProps = {
  drivers: DriverRow[];
  pagedDrivers: DriverRow[];
  page: number;
  pageSize: number;
  canNext: boolean;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onOpenCreate: () => void;
  onOpenEdit: (driver: DriverRow) => void;
  onPageChange: (page: number) => void;
  onStartDelete: (id: string) => void;
};

export function DriverListView({
  drivers,
  pagedDrivers,
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
}: DriverListViewProps) {
  return (
    <section
      dir="rtl"
      className="mt-4 space-y-4 container mx-auto max-w-5xl"
      aria-label="ניהול פרטי הנהגים"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {/* <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={loading}
          >
            רענן
          </Button> */}
          <Button
            type="button"
            size="sm"
            onClick={onOpenCreate}
            className="bg-toyota-primary text-white hover:bg-toyota-primary/80"
          >
            <PlusIcon className="w-4 h-4" />
            הוסף נהג חדש
          </Button>
        </div>
      </div>
      <div className="space-y-3">
        {loading ? <div className="text-sm">טוען נהגים...</div> : null}
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

                <th className="px-3 py-2 text-right">נוצר</th>
                {/* //   <th className="px-3 py-2 text-right">עודכן</th> */}
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

                    <td className="px-3 py-2">
                      {formatDriverTimestamp(d.created_at)}
                    </td>
                    {/* <td className="px-3 py-2">
                      {formatDriverTimestamp(d.updated_at)}
                    </td> */}
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
        {drivers.length > pageSize ? (
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
              {Math.max(1, Math.ceil(drivers.length / pageSize))}
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
