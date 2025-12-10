'use client';

import dayjs from '@/lib/dayjs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import { MapPinIcon } from 'lucide-react';

export type TaskCardProps = {
  id: string;
  title: string;
  type: string;
  priority: 'נמוכה' | 'בינונית' | 'גבוהה';
  status: 'בהמתנה' | 'בעבודה' | 'חסומה' | 'הושלמה';
  estimatedStart?: string | Date | null;
  estimatedEnd?: string | Date | null;
  address?: string | null;
  clientName?: string | null;
  stops?: {
    address: string;
    clientName?: string | null;
    advisorName?: string | null;
  }[];
  vehicle?: { licensePlate?: string | null; model?: string | null } | null;
  onStatusChange?: (next: TaskCardProps['status']) => void;
};

export function TaskCard(props: TaskCardProps) {
  const {
    title,
    type,
    priority,
    status,
    estimatedStart,
    estimatedEnd,
    address,
    clientName,
    stops,
    vehicle,
    onStatusChange,
  } = props;

  const priorityColor =
    priority === 'גבוהה'
      ? 'bg-red-600'
      : priority === 'בינונית'
      ? 'bg-yellow-500'
      : 'bg-green-600';

  const statusTheme: Record<
    TaskCardProps['status'],
    { pill: string; dot: string; on: string }
  > = {
    בהמתנה: {
      pill: 'bg-gray-100 text-gray-800',
      dot: 'bg-gray-500',
      on: 'data-[state=on]:bg-gray-700 data-[state=on]:border-gray-700',
    },
    בעבודה: {
      pill: 'bg-blue-50 text-blue-800',
      dot: 'bg-blue-500',
      on: 'data-[state=on]:bg-blue-600 data-[state=on]:border-blue-600',
    },
    חסומה: {
      pill: 'bg-amber-50 text-amber-800',
      dot: 'bg-amber-500',
      on: 'data-[state=on]:bg-amber-500 data-[state=on]:border-amber-500',
    },
    הושלמה: {
      pill: 'bg-emerald-50 text-emerald-800',
      dot: 'bg-emerald-500',
      on: 'data-[state=on]:bg-emerald-600 data-[state=on]:border-emerald-600',
    },
  };

  const timeWindow =
    estimatedStart && estimatedEnd
      ? `${dayjs(estimatedStart).format('HH:mm')} – ${dayjs(
          estimatedEnd
        ).format('HH:mm')}`
      : estimatedEnd
      ? `עד ${dayjs(estimatedEnd).format('HH:mm')}`
      : 'ללא זמן יעד';

  const primaryAddress =
    stops && stops.length > 0 ? stops[0].address : address || undefined;

  const wazeHref = primaryAddress
    ? `waze://?navigate=yes&q=${encodeURIComponent(primaryAddress)}`
    : undefined;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-center gap-1">
            <span className="text-xs text-gray-500">עדיפות</span>
            <span
              className={cn(
                'inline-flex rounded px-2 py-1 text-xs text-white',
                priorityColor
              )}
            >
              {priority}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-center text-xs text-gray-500 sm:text-right">
            סטטוס
          </span>
          <ToggleGroup
            type="single"
            value={status}
            onValueChange={(value) => {
              if (!value || value === status) return;
              onStatusChange?.(value as TaskCardProps['status']);
            }}
            aria-label="עדכון סטטוס משימה"
            className="w-full justify-between"
          >
            {(
              [
                'בהמתנה',
                'בעבודה',
                'הושלמה',
                'חסומה',
              ] as TaskCardProps['status'][]
            ).map((value) => (
              <ToggleGroupItem
                key={value}
                value={value}
                className={cn(
                  'flex-1 rounded-full border border-gray-200 bg-gray-50 px-2 py-1 text-[11px] text-gray-700 sm:text-xs',
                  statusTheme[value].on
                )}
              >
                {value}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </div>

      <h3 className="mt-2 text-lg font-semibold">{title}</h3>
      <p className="text-sm text-gray-600">{type}</p>

      <div className="mt-3 space-y-2 text-sm text-gray-700">
        <div>חלון זמן: {timeWindow}</div>
        {stops && stops.length > 0 ? (
          <div className="space-y-1 rounded border border-gray-200 bg-gray-50 p-2">
            {stops.map((s, idx) => (
              <div key={`${s.address}-${idx}`} className="space-y-0.5">
                <div className="text-xs font-semibold text-gray-600">
                  עצירה {idx + 1}
                </div>
                {s.address ? <div>כתובת: {s.address}</div> : null}
                {s.clientName ? <div>לקוח: {s.clientName}</div> : null}
                {s.advisorName ? <div>יועץ: {s.advisorName}</div> : null}
              </div>
            ))}
          </div>
        ) : (
          <>
            {address ? <div>כתובת: {address}</div> : null}
            {clientName ? <div>לקוח: {clientName}</div> : null}
          </>
        )}
        {vehicle?.licensePlate ? (
          <div>
            רכב: {vehicle.licensePlate}
            {vehicle.model ? ` • ${vehicle.model}` : ''}
          </div>
        ) : null}
      </div>

      <div className="mt-3 flex gap-2">
        {wazeHref ? (
          <a
            href={wazeHref}
            className="inline-flex items-center justify-center rounded-md bg-primary px-3 py-2 text-sm text-white hover:bg-red-700"
          >
            <MapPinIcon className="w-4 h-4 mr-2" />
            פתיחה ב-Waze
          </a>
        ) : null}
      </div>
    </div>
  );
}
