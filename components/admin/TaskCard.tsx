'use client';

import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import dayjs from '@/lib/dayjs';
import type { TaskStatus, TaskPriority, TaskType } from '@/types/task';
import type { TaskCardProps } from '@/types/board';
import { PencilIcon, Trash2Icon } from 'lucide-react';
import {
  getAdvisorColorBgClass,
  getAdvisorColorTextClass,
} from '@/lib/advisorColors';
import { formatDistance } from '@/lib/geocoding';
import { formatLicensePlate } from '@/lib/vehicleLicensePlate';
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { TaskAttachments } from './TaskAttachments';

/**
 * TaskCard Component
 * Renders a single task card within the Kanban board with drag support.
 */
export function TaskCard({
  task,
  columnId,
  isActive,
  assignees,
  driverMap,
  clientMap,
  vehicleMap,
  conflictInfo,
  onEdit,
  onDelete,
  selected,
  onToggleSelected,
  showSelect,
}: TaskCardProps) {
  const client = clientMap.get(task.client_id || '');
  const vehicle = vehicleMap.get(task.vehicle_id || '');
  const leadAssignee = assignees.find((a) => a.is_lead);
  const leadDriver = leadAssignee
    ? driverMap.get(leadAssignee.driver_id)
    : null;

  // Setup draggable
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
    data: { type: 'task', taskId: task.id, sourceColumn: columnId },
  });

  return (
    <div
      ref={setNodeRef}
      id={task.id}
      className={`relative cursor-grab active:cursor-grabbing select-none rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition-all hover:shadow-md hover:border-gray-300 max-w-full ${
        isActive ? 'opacity-50 ring-2 ring-primary' : ''
      } ${isDragging ? 'opacity-50' : ''}`}
      aria-label={`משימה: ${task.title}`}
      data-draggable-id={task.id}
      {...attributes}
      {...listeners}
    >
      {conflictInfo && (
        <div className="pointer-events-none absolute -top-2 -left-2 rounded bg-orange-500 px-2 py-0.5 text-[10px] font-semibold text-white shadow">
          עודכן ע&quot;י {conflictInfo.by || 'שרת'}{' '}
          {conflictInfo.at
            ? `(${new Date(conflictInfo.at).toLocaleTimeString()})`
            : ''}
        </div>
      )}
      {/* Header: Select + Title + Priority Badge */}
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          {showSelect && (
            <input
              type="checkbox"
              checked={selected}
              onChange={onToggleSelected}
              aria-label="בחר משימה"
            />
          )}
          {/* <h4 className="flex-1 line-clamp-2 font-semibold text-gray-900 text-sm">
            {task.title}
          </h4> */}
        </div>
        {task.priority === 'מיידי' && (
          <span
            className={`shrink-0 inline-block rounded-full px-1.5 py-0.5 text-xs font-bold text-white ${priorityColor(
              task.priority
            )}`}
          >
            {priorityLabel(task.priority)}
          </span>
        )}
      </div>

      {/* Type badge */}
      <p className="mb-2 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
        {typeLabel(task.type)}
      </p>

      {/* Driver info */}
      {leadDriver && (
        <div className="mb-2 flex items-center gap-1 text-xs text-gray-600">
          <span className="font-medium">👨‍✈️</span>
          <span className="truncate">{leadDriver.name || 'Unknown'}</span>
        </div>
      )}

      {/* Client info - show all clients for multi-stop tasks */}
      {(() => {
        const multiStopTypes: TaskType[] = [
          'הסעת לקוח הביתה',
          'הסעת לקוח למוסך',
        ];
        const isMultiStop = multiStopTypes.includes(task.type);
        const stops = task.stops || [];

        if (isMultiStop && stops.length > 0) {
          // Get unique clients from stops, preserving order
          const clientIds = stops
            .map((stop) => stop.client_id)
            .filter((id): id is string => Boolean(id));
          const uniqueClientIds = Array.from(new Set(clientIds));

          return uniqueClientIds.map((clientId) => {
            const stopClient = clientMap.get(clientId);
            if (!stopClient) return null;

            return (
              <div
                key={clientId}
                className="mb-1.5 flex items-center gap-1 text-xs text-gray-600"
              >
                <span className="font-medium">👤</span>
                <span className="truncate">{stopClient.name}</span>
              </div>
            );
          });
        } else if (client) {
          // Show single client for non-multi-stop tasks
          return (
            <div className="mb-2 flex items-center gap-1 text-xs text-gray-600">
              <span className="font-medium">🏢</span>
              <span className="truncate">{client.name}</span>
            </div>
          );
        }
        return null;
      })()}

      {/* Vehicle info */}
      {vehicle && (
        <div className="mb-2 flex items-center gap-1 text-xs text-gray-600">
          <span className="font-medium">🚗</span>
          <span className="font-mono font-bold">
            {formatLicensePlate(vehicle.license_plate)}
            {vehicle.model ? ` · ${vehicle.model}` : ''}
          </span>
        </div>
      )}

      {/* Address(es) info */}
      {task.stops && task.stops.length > 0 ? (
        <div className="mb-2 space-y-1">
          {task.stops
            .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
            .map((stop, index) => (
              <div
                key={stop.id}
                className="flex items-center justify-between gap-1 text-xs text-gray-600"
              >
                <div className="flex items-center gap-1 truncate">
                  <span className="font-medium">📍</span>
                  <span className="truncate" title={stop.address}>
                    {index + 1}. {stop.address}
                  </span>
                </div>
                {stop.distance_from_garage !== null &&
                  stop.distance_from_garage !== undefined && (
                    <span
                      className="shrink-0 text-[10px] text-gray-400 font-medium"
                      dir="ltr"
                    >
                      ({formatDistance(stop.distance_from_garage)})
                    </span>
                  )}
              </div>
            ))}
        </div>
      ) : (
        <div className="mb-2 flex items-center justify-between gap-1 text-xs text-gray-600">
          <div className="flex items-center gap-1 truncate">
            <span className="font-medium">📍</span>
            <span
              className="truncate"
              title={task.address || 'לא הוכנסה כתובת'}
            >
              {task.address || 'לא הוכנסה כתובת'}
            </span>
          </div>
          {task.distance_from_garage !== null &&
            task.distance_from_garage !== undefined && (
              <span
                className="shrink-0 text-[10px] text-gray-400 font-medium"
                dir="ltr"
              >
                ({formatDistance(task.distance_from_garage)})
              </span>
            )}
        </div>
      )}

      {/* Advisor info */}
      {(task.advisor_name || task.advisor_color) && (
        <div className="mb-2 flex items-center gap-1 text-xs text-gray-600 flex-wrap">
          <span className="font-medium">👨‍💼</span>
          {task.advisor_name && (
            <span className="truncate" title={task.advisor_name}>
              {task.advisor_name}
            </span>
          )}
          {task.advisor_color && (
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getAdvisorColorBgClass(
                task.advisor_color
              )} ${getAdvisorColorTextClass(task.advisor_color)}`}
            >
              {task.advisor_color}
            </span>
          )}
        </div>
      )}

      {/* Task Details */}
      {task.details && (
        <div className="mb-2 flex items-start gap-1 text-xs text-gray-600">
          <span className="font-medium shrink-0">📝</span>
          <span className="line-clamp-2" title={task.details}>
            {task.details}
          </span>
        </div>
      )}

      {/* Time window */}

      <div className="mb-2 text-xs text-gray-500">
        {task.estimated_start
          ? dayjs(task.estimated_start).format('DD/MM/YYYY')
          : 'ללא זמן יעד'}
      </div>
      <div className="mb-2 text-xs text-gray-500">
        {formatDate(task.estimated_start)} - {formatDate(task.estimated_end)}
      </div>

      {/* Task Attachments (images and signatures) */}
      <TaskAttachments key={task.id} taskId={task.id} taskType={task.type} />

      {/* Footer: Status + Actions */}
      <div className="mt-2 flex items-center justify-between">
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${statusColor(
            task.status
          )}`}
        >
          {statusLabel(task.status)}
        </span>
        <div className="flex flex-row items-end gap-4">
          <button
            className="text-xs text-blue-500 hover:underline flex items-center gap-1"
            onClick={() => onEdit(task)}
          >
            <PencilIcon className="w-4 h-4" />
          </button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                type="button"
                className="text-xs text-red-600 hover:underline flex items-center gap-1"
                onClick={(e) => e.stopPropagation()}
              >
                <Trash2Icon className="w-4 h-4" />
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>למחוק את המשימה?</AlertDialogTitle>
                <AlertDialogDescription>
                  פעולה זו תסמן את המשימה כמחוקה. אפשר יהיה לשחזר אותה מהמערכת
                  במידת הצורך.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>בטל</AlertDialogCancel>
                <AlertDialogAction onClick={() => onDelete(task)}>
                  מחק
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}

/**
 * Utility functions for labels and colors
 */
export function statusLabel(status: TaskStatus): string {
  const labels: Record<TaskStatus, string> = {
    בהמתנה: 'ממתינה לביצוע',
    בעבודה: 'בביצוע',
    חסומה: 'חסומה',
    הושלמה: 'בוצעה',
  };
  return labels[status] || status;
}

export function statusColor(status: TaskStatus): string {
  const colors: Record<TaskStatus, string> = {
    בהמתנה: 'bg-gray-100 text-gray-800',
    בעבודה: 'bg-blue-100 text-blue-800',
    חסומה: 'bg-red-100 text-red-800',
    הושלמה: 'bg-green-100 text-green-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
}

export function priorityLabel(priority: TaskPriority): string {
  const labels: Record<TaskPriority, string> = {
    'ללא עדיפות': 'ללא עדיפות',
    מיידי: 'מיידי',
    נמוכה: 'נמוכה',
    בינונית: 'בינונית',
    גבוהה: 'גבוהה',
  };
  return labels[priority] || priority;
}

export function priorityColor(priority: TaskPriority): string {
  const colors: Record<TaskPriority, string> = {
    'ללא עדיפות': 'bg-gray-400',
    מיידי: 'bg-red-600',
    נמוכה: 'bg-gray-500',
    בינונית: 'bg-yellow-500',
    גבוהה: 'bg-red-600',
  };
  return colors[priority] || 'bg-gray-500';
}

export function typeLabel(type: TaskType): string {
  const labels: Record<TaskType, string> = {
    'איסוף רכב/שינוע': 'איסוף רכב/שינוע',
    'החזרת רכב/שינוע': 'החזרת רכב/שינוע',
    'מסירת רכב חלופי': 'מסירת רכב חלופי',
    'הסעת לקוח הביתה': 'הסעת לקוח הביתה',
    'הסעת לקוח למוסך': 'הסעת לקוח למוסך',
    'ביצוע טסט': 'ביצוע טסט',
    'חילוץ רכב תקוע': 'חילוץ רכב תקוע',
    אחר: 'אחר',
  };
  return labels[type];
}

function formatDate(dateStr: string): string {
  return dayjs(dateStr).format('HH:mm');
}
