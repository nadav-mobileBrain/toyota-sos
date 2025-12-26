'use client';

import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { format, parseISO } from 'date-fns';
import { he } from 'date-fns/locale';
import { Clock, MapPin, User, Car } from 'lucide-react';
import { formatDistance } from '@/lib/geocoding';
import type { Task, TaskStatus, TaskType } from '@/types/task';
import type { Driver } from '@/types/user';
import type { Client } from '@/types/entity';
import { cn } from '@/lib/utils';

// Color mappings - Google Calendar style colors
const typeColors: Record<TaskType, string> = {
  'איסוף רכב/שינוע': 'bg-blue-500 hover:bg-blue-600',
  'החזרת רכב/שינוע': 'bg-green-500 hover:bg-green-600',
  'מסירת רכב חלופי': 'bg-purple-500 hover:bg-purple-600',
  'הסעת לקוח הביתה': 'bg-teal-500 hover:bg-teal-600',
  'הסעת לקוח למוסך': 'bg-orange-500 hover:bg-orange-600',
  'ביצוע טסט': 'bg-yellow-500 hover:bg-yellow-600',
  'חילוץ רכב תקוע': 'bg-red-500 hover:bg-red-600',
  אחר: 'bg-slate-500 hover:bg-slate-600',
};

// Default color if type doesn't match
const DEFAULT_COLOR = 'bg-gray-500 hover:bg-gray-600';

// Get color for task type with fallback
const getTaskColor = (type: TaskType): string => {
  return typeColors[type] || DEFAULT_COLOR;
};

const statusColors: Record<TaskStatus, string> = {
  בהמתנה: 'opacity-90',
  בעבודה: 'opacity-100 ring-2 ring-white ring-offset-1',
  חסומה: 'opacity-60 bg-stripes',
  הושלמה: 'opacity-50',
};

interface CalendarTaskProps {
  task: Task;
  assignedDrivers?: Driver[];
  client?: Client | null;
  compact?: boolean;
  onClick?: () => void;
}

export function CalendarTask({
  task,
  assignedDrivers = [],
  client,
  compact = false,
  onClick,
}: CalendarTaskProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: task.id,
    });

  const style = {
    transform: CSS.Translate.toString(transform),
  };

  const startTime = format(parseISO(task.estimated_start), 'HH:mm', {
    locale: he,
  });

  if (compact) {
    // Compact view for month grid - shows task type clearly
    return (
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        onClick={(e) => {
          e.stopPropagation();
          onClick?.();
        }}
        className={cn(
          'cursor-pointer rounded-md px-2 py-1.5 text-xs font-medium text-white transition-all shadow-sm',
          getTaskColor(task.type),
          statusColors[task.status] || '',
          isDragging && 'opacity-50 shadow-lg scale-105'
        )}
        dir="rtl"
      >
        <div className="flex items-center justify-between gap-1">
          <span className="font-bold truncate">{task.type}</span>
          <span className="text-[10px] opacity-80 shrink-0">{startTime}</span>
        </div>
      </div>
    );
  }

  // Full view for week grid
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      className={cn(
        'cursor-pointer rounded-lg p-2.5 text-sm text-white transition-all shadow-md',
        getTaskColor(task.type),
        statusColors[task.status] || '',
        isDragging && 'opacity-50 shadow-xl ring-2 ring-white scale-105'
      )}
      dir="rtl"
    >
      {/* Header: Time */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 opacity-80" />
          <span className="font-bold">{startTime}</span>
          {task.estimated_end && (
            <span className="opacity-70">
              - {format(parseISO(task.estimated_end), 'HH:mm', { locale: he })}
            </span>
          )}
        </div>
      </div>

      {/* Task type badge */}
      <div className="mb-1.5">
        <span className="inline-block rounded-full bg-white/20 px-2 py-0.5 text-xs font-medium">
          {task.type}
        </span>
      </div>

      {/* Address(es) */}
      {task.stops && task.stops.length > 0 ? (
        <div className="space-y-1 mb-1">
          {task.stops
            .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
            .map((stop, index) => (
              <div
                key={stop.id}
                className="flex items-start justify-between gap-1.5 text-xs opacity-90"
              >
                <div className="flex items-start gap-1.5 truncate">
                  <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span className="line-clamp-1">
                    {index + 1}. {stop.address}
                  </span>
                </div>
                {stop.distance_from_garage !== null &&
                  stop.distance_from_garage !== undefined && (
                    <span
                      className="shrink-0 text-[10px] opacity-70 font-medium"
                      dir="ltr"
                    >
                      ({formatDistance(stop.distance_from_garage)})
                    </span>
                  )}
              </div>
            ))}
        </div>
      ) : (
        task.address && (
          <div className="flex items-start justify-between gap-1.5 text-xs opacity-90 mb-1">
            <div className="flex items-start gap-1.5 truncate">
              <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span className="line-clamp-1">{task.address}</span>
            </div>
            {task.distance_from_garage !== null &&
              task.distance_from_garage !== undefined && (
                <span
                  className="shrink-0 text-[10px] opacity-70 font-medium"
                  dir="ltr"
                >
                  ({formatDistance(task.distance_from_garage)})
                </span>
              )}
          </div>
        )
      )}

      {/* Driver */}
      {assignedDrivers.length > 0 && (
        <div className="flex items-center gap-1.5 text-xs opacity-90">
          <User className="h-3.5 w-3.5" />
          <span className="truncate">
            {assignedDrivers.map((d) => d.name || d.email).join(', ')}
          </span>
        </div>
      )}

      {/* Client */}
      {client && (
        <div className="flex items-center gap-1.5 text-xs opacity-90 mt-0.5">
          <Car className="h-3.5 w-3.5" />
          <span className="truncate">{client.name}</span>
        </div>
      )}
    </div>
  );
}

// Overlay component for drag preview
export function CalendarTaskOverlay({ task }: { task: Task }) {
  const startTime = format(parseISO(task.estimated_start), 'HH:mm', {
    locale: he,
  });

  return (
    <div
      className={cn(
        'cursor-grabbing rounded-lg p-2.5 text-white shadow-2xl text-sm w-64',
        getTaskColor(task.type)
      )}
      dir="rtl"
    >
      <div className="flex items-center gap-1.5 mb-1">
        <Clock className="h-3.5 w-3.5 opacity-80" />
        <span className="font-bold">{startTime}</span>
      </div>
      <div className="mb-1">
        <span className="inline-block rounded-full bg-white/20 px-2 py-0.5 text-xs font-medium">
          {task.type}
        </span>
      </div>
      {task.stops && task.stops.length > 0 ? (
        <div className="space-y-1">
          {task.stops
            .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
            .map((stop, index) => (
              <div
                key={stop.id}
                className="flex items-start gap-1.5 text-xs opacity-90"
              >
                <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span className="line-clamp-1">
                  {index + 1}. {stop.address}
                </span>
              </div>
            ))}
        </div>
      ) : (
        task.address && (
          <div className="flex items-start gap-1.5 text-xs opacity-90">
            <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span className="line-clamp-1">{task.address}</span>
          </div>
        )
      )}
    </div>
  );
}
