'use client';

import dayjs from '@/lib/dayjs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

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
    vehicle,
    onStatusChange,
  } = props;

  const priorityColor =
    priority === 'גבוהה'
      ? 'bg-red-600'
      : priority === 'בינונית'
      ? 'bg-yellow-500'
      : 'bg-green-600';

  const timeWindow =
    estimatedStart && estimatedEnd
      ? `${dayjs(estimatedStart).format('HH:mm')} – ${dayjs(
          estimatedEnd
        ).format('HH:mm')}`
      : estimatedEnd
      ? `עד ${dayjs(estimatedEnd).format('HH:mm')}`
      : 'ללא זמן יעד';

  const wazeHref = address
    ? `waze://?navigate=yes&q=${encodeURIComponent(address)}`
    : undefined;

  return (
    <div className="rounded-lg border border-gray-200 p-4 shadow-sm bg-white">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col items-center gap-2">
          <span>עדיפות</span>
          <span
            className={`inline-flex px-2 py-1 rounded text-xs text-white ${priorityColor}`}
          >
            {priority}
          </span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <span>סטטוס</span>
          <ToggleGroup
            type="single"
            value={status}
            onValueChange={(value) => {
              if (!value || value === status) return;
              onStatusChange?.(value as TaskCardProps['status']);
            }}
            aria-label="סטטוס משימה"
          >
            <ToggleGroupItem value="בהמתנה">בהמתנה</ToggleGroupItem>
            <ToggleGroupItem value="בעבודה">בעבודה</ToggleGroupItem>
            <ToggleGroupItem value="חסומה">חסומה</ToggleGroupItem>
            <ToggleGroupItem value="הושלמה">הושלמה</ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      <h3 className="mt-2 text-lg font-semibold">{title}</h3>
      <p className="text-sm text-gray-600">{type}</p>

      <div className="mt-3 space-y-1 text-sm text-gray-700">
        <div>חלון זמן: {timeWindow}</div>
        {address ? <div>כתובת: {address}</div> : null}
        {clientName ? <div>לקוח: {clientName}</div> : null}
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
            className="inline-flex items-center justify-center rounded-md bg-toyota-primary px-3 py-2 text-sm text-white hover:bg-red-700"
          >
            פתיחה ב-Waze
          </a>
        ) : null}
      </div>
    </div>
  );
}
