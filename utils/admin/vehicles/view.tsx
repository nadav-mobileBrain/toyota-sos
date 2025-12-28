'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { VehicleRow } from '@/utils/admin/vehicles/types';
import { formatVehicleTimestamp } from '@/utils/admin/vehicles/dialogs';
import { formatLicensePlate } from '@/lib/vehicleLicensePlate';
import { PencilIcon, PlusIcon, SearchIcon, Trash2Icon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

type VehicleListViewProps = {
  vehicles: VehicleRow[];
  pagedVehicles: VehicleRow[];
  page: number;
  pageSize: number;
  canNext: boolean;
  loading: boolean;
  error: string | null;
  searchQuery: string;
  onSearchChange: (val: string) => void;
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
  searchQuery,
  onSearchChange,
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
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

        <div className="relative w-full sm:w-1/4">
          <SearchIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            type="text"
            placeholder="חיפוש..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pr-9 h-9 text-sm"
          />
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
        <div className="overflow-x-auto rounded border bg-white shadow-sm">
          <table className="min-w-full text-sm rtl:text-right">
            <thead className="bg-gray-50">
              <tr className="text-xs font-semibold text-gray-600 border-b">
                <th className="px-3 py-3 text-right">מספר רישוי</th>
                <th className="px-3 py-3 text-right">מודל</th>
                <th className="px-3 py-3 text-right">סטטוס</th>
                <th className="px-3 py-3 text-right">סיבת אי זמינות</th>
                <th className="px-3 py-3 text-right">נוצר</th>
                <th className="px-3 py-3 text-right">עודכן</th>
                <th className="px-3 py-3 text-center">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {pagedVehicles.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-3 py-8 text-center text-xs text-gray-500"
                  >
                    {searchQuery.length >= 2 ? 'לא נמצאו רכבים תואמים לחיפוש.' : 'אין רכבים להצגה.'}
                  </td>
                </tr>
              ) : (
                pagedVehicles.map((v) => (
                  <tr key={v.id} className="border-b last:border-0 hover:bg-gray-50/50 transition-colors text-xs">
                    <td className="px-3 py-3 font-mono font-medium">
                      {formatLicensePlate(v.license_plate)}
                    </td>
                    <td className="px-3 py-3 text-gray-700">{v.model || '—'}</td>
                    <td className="px-3 py-3">
                      {v.is_available ? (
                        <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100">
                          זמין
                        </Badge>
                      ) : (
                        <Badge className="bg-red-100 text-red-800 border-red-200 hover:bg-red-100">
                          לא זמין
                        </Badge>
                      )}
                    </td>
                    <td className="px-3 py-3 text-gray-600 max-w-[150px] truncate">
                      {v.unavailability_reason || '—'}
                    </td>
                    <td className="px-3 py-3 text-gray-500">
                      {formatVehicleTimestamp(v.created_at)}
                    </td>
                    <td className="px-3 py-3 text-gray-500">
                      {formatVehicleTimestamp(v.updated_at)}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex gap-2 justify-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => onOpenEdit(v)}
                          title="ערוך"
                        >
                          <PencilIcon className="w-4 h-4 text-blue-500" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                          onClick={() => onStartDelete(v.id)}
                          title="מחק"
                        >
                          <Trash2Icon className="w-4 h-4" />
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

