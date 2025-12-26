'use client';

import { Button } from '@/components/ui/button';
import type { VehicleRow } from '@/utils/admin/vehicles/types';
import { formatVehicleTimestamp } from '@/utils/admin/vehicles/dialogs';
import { formatLicensePlate } from '@/lib/vehicleLicensePlate';
import { PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

type VehicleListViewProps = {
  vehicles: VehicleRow[];
  pagedVehicles: VehicleRow[];
  page: number;
  pageSize: number;
  canNext: boolean;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onOpenCreate: () => void;
  onOpenEdit: (vehicle: VehicleRow) => void;
  onPageChange: (page: number) => void;
  onStartDelete: (id: string) => void;
};

export function VehicleListView({
  vehicles,
  pagedVehicles,
  page,
  pageSize,
  canNext,
  loading,
  error,
  onOpenCreate,
  onOpenEdit,
  onPageChange,
  onStartDelete,
}: VehicleListViewProps) {
  return (
    <section
      dir="rtl"
      className="mt-4 space-y-4 container mx-auto max-w-5xl"
      aria-label="ניהול רכבים"
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
            הוסף רכב חדש
          </Button>
        </div>
      </div>
      <div className="space-y-3">
        {loading ? <div className="text-sm">טוען רכבים...</div> : null}
        {error ? (
          <div
            role="alert"
            className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700"
          >
            {error}
          </div>
        ) : null}
        <div className="overflow-x-auto rounded border bg-white">
          <table className="min-w-full text-sm rtl:text-right">
            <thead className="bg-gray-50">
              <tr className="text-xs font-semibold text-gray-600">
                <th className="px-3 py-2 text-right">מספר רישוי</th>
                <th className="px-3 py-2 text-right">מודל</th>
                <th className="px-3 py-2 text-right">סטטוס</th>
                <th className="px-3 py-2 text-right">סיבת אי זמינות</th>
                <th className="px-3 py-2 text-right">נוצר</th>
                <th className="px-3 py-2 text-right">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {pagedVehicles.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-4 text-center text-xs text-gray-500"
                  >
                    אין רכבים להצגה.
                  </td>
                </tr>
              ) : (
                pagedVehicles.map((v) => (
                  <tr key={v.id} className="border-t text-xs">
                    <td className="px-3 py-2 font-mono">
                      {formatLicensePlate(v.license_plate)}
                    </td>
                    <td className="px-3 py-2">{v.model || '—'}</td>
                    <td className="px-3 py-2">
                      {v.is_available ? (
                        <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                          זמין
                        </Badge>
                      ) : (
                        <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
                          לא זמין
                        </Badge>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {v.unavailability_reason || '—'}
                    </td>
                    <td className="px-3 py-2">
                      {formatVehicleTimestamp(v.created_at)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-[11px]"
                          onClick={() => onOpenEdit(v)}
                        >
                          <PencilIcon className="w-4 h-4 text-blue-500 hover:text-blue-600" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-[11px]"
                          onClick={() => onStartDelete(v.id)}
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
        {vehicles.length > pageSize ? (
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
              {Math.max(1, Math.ceil(vehicles.length / pageSize))}
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

