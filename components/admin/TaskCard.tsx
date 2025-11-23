'use client';

import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import dayjs from '@/lib/dayjs';
import type { TaskStatus, TaskPriority, TaskType } from '@/types/task';
import type { TaskCardProps } from '@/types/board';
import { PencilIcon, Trash2Icon } from 'lucide-react';
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
      className={`relative cursor-grab active:cursor-grabbing select-none rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition-all hover:shadow-md hover:border-gray-300 ${
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
        <span
          className={`shrink-0 inline-block rounded-full px-1.5 py-0.5 text-xs font-bold text-white ${priorityColor(
            task.priority
          )}`}
        >
          {priorityLabel(task.priority)}
        </span>
      </div>

      {/* Type badge */}
      <p className="mb-2 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
        {typeLabel(task.type)}
      </p>

      {/* Driver info */}
      {leadDriver && (
        <div className="mb-2 flex items-center gap-1 text-xs text-gray-600">
          <span className="font-medium">👤</span>
          <span className="truncate">{leadDriver.name || 'Unknown'}</span>
        </div>
      )}

      {/* Client info */}
      {client && (
        <div className="mb-2 flex items-center gap-1 text-xs text-gray-600">
          <span className="font-medium">🏢</span>
          <span className="truncate">{client.name}</span>
        </div>
      )}

      {/* Vehicle info */}
      {vehicle && (
        <div className="mb-2 flex items-center gap-1 text-xs text-gray-600">
          <span className="font-medium">🚗</span>
          <span className="font-mono font-bold">
            {vehicle.license_plate}
            {vehicle.model ? ` · ${vehicle.model}` : ''}
          </span>
        </div>
      )}

      {/* Address info */}
      <div className="mb-2 flex items-center gap-1 text-xs text-gray-600">
        <span className="font-medium">📍</span>
        <span className="truncate" title={task.address || 'לא הוכנסה כתובת'}>
          {task.address || 'לא הוכנסה כתובת'}
        </span>
      </div>

      {/* Time window */}
      <div className="mb-2 text-xs text-gray-500">
        {formatDate(task.estimated_start)} - {formatDate(task.estimated_end)}
      </div>

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
    בהמתנה: 'בהמתנה',
    בעבודה: 'בעבודה',
    חסומה: 'חסומה',
    הושלמה: 'הושלמה',
  };
  return labels[status];
}

export function statusColor(status: TaskStatus): string {
  const colors: Record<TaskStatus, string> = {
    בהמתנה: 'bg-gray-100 text-gray-800',
    בעבודה: 'bg-blue-100 text-blue-800',
    חסומה: 'bg-red-100 text-red-800',
    הושלמה: 'bg-green-100 text-green-800',
  };
  return colors[status];
}

export function priorityLabel(priority: TaskPriority): string {
  const labels: Record<TaskPriority, string> = {
    נמוכה: 'נמוכה',
    בינונית: 'בינונית',
    גבוהה: 'גבוהה',
  };
  return labels[priority];
}

export function priorityColor(priority: TaskPriority): string {
  const colors: Record<TaskPriority, string> = {
    נמוכה: 'bg-gray-500',
    בינונית: 'bg-yellow-500',
    גבוהה: 'bg-red-600',
  };
  return colors[priority];
}

export function typeLabel(type: TaskType): string {
  const labels: Record<TaskType, string> = {
    'איסוף/הורדת רכב': 'איסוף/הורדת רכב',
    'הסעת רכב חלופי': 'הסעת רכב חלופי',
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
