'use client';

import React, { useState, useMemo, useCallback, Suspense } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  PointerSensor,
  KeyboardSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';

/**
 * Type definitions for TasksBoard state and data structures
 */
export type TaskStatus = 'pending' | 'in_progress' | 'blocked' | 'completed';
export type TaskPriority = 'low' | 'medium' | 'high';
export type TaskType = 'pickup_or_dropoff_car' | 'replacement_car_delivery' | 'drive_client_home' | 'drive_client_to_dealership' | 'licence_test' | 'rescue_stuck_car' | 'other';
export type GroupBy = 'driver' | 'status';

export interface Task {
  id: string;
  title: string;
  type: TaskType;
  priority: TaskPriority;
  status: TaskStatus;
  estimated_start: string;
  estimated_end: string;
  address: string;
  details: string | null;
  client_id: string | null;
  vehicle_id: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Driver {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
}

export interface TaskAssignee {
  id: string;
  task_id: string;
  driver_id: string;
  is_lead: boolean;
  assigned_at: string;
}

export interface Client {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
}

export interface Vehicle {
  id: string;
  license_plate: string;
  model: string;
  vin: string;
}

export interface DragItem {
  type: string;
  taskId: string;
  sourceColumn: string;
}

export interface TasksBoardProps {
  initialTasks: Task[];
  drivers: Driver[];
  taskAssignees: TaskAssignee[];
  clients: Client[];
  vehicles: Vehicle[];
}

/**
 * TasksBoard Component (7.1)
 * Main Kanban board component with state management for tasks, drivers, and grouping mode.
 * Handles drag-and-drop context initialization (no-op handlers for now).
 */
export function TasksBoard({
  initialTasks,
  drivers,
  taskAssignees,
  clients,
  vehicles,
}: TasksBoardProps) {
  // State management
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [groupBy, setGroupBy] = useState<GroupBy>('status');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);

  // Configure drag-and-drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      distance: 8,
    }),
    useSensor(KeyboardSensor),
    useSensor(TouchSensor, {
      distance: 8,
    })
  );

  // Create lookup maps
  const driverMap = useMemo(() => {
    const map = new Map<string, Driver>();
    drivers.forEach((d) => map.set(d.id, d));
    return map;
  }, [drivers]);

  const taskAssigneeMap = useMemo(() => {
    const map = new Map<string, TaskAssignee[]>();
    taskAssignees.forEach((ta) => {
      if (!map.has(ta.task_id)) {
        map.set(ta.task_id, []);
      }
      map.get(ta.task_id)!.push(ta);
    });
    return map;
  }, [taskAssignees]);

  const clientMap = useMemo(() => {
    const map = new Map<string, Client>();
    clients.forEach((c) => map.set(c.id, c));
    return map;
  }, [clients]);

  const vehicleMap = useMemo(() => {
    const map = new Map<string, Vehicle>();
    vehicles.forEach((v) => map.set(v.id, v));
    return map;
  }, [vehicles]);

  // Compute columns based on groupBy mode
  const columns = useMemo(() => {
    if (groupBy === 'driver') {
      // Group by driver: create columns for each assigned driver
      const driverIds = new Set<string>();
      taskAssignees.forEach((ta) => driverIds.add(ta.driver_id));
      return Array.from(driverIds).map((driverId) => ({
        id: driverId,
        label: driverMap.get(driverId)?.name || 'Unknown Driver',
        type: 'driver' as const,
      }));
    } else {
      // Group by status: create columns for each status
      const statuses: TaskStatus[] = ['pending', 'in_progress', 'blocked', 'completed'];
      return statuses.map((status) => ({
        id: status,
        label: statusLabel(status),
        type: 'status' as const,
      }));
    }
  }, [groupBy, taskAssignees, driverMap]);

  // Get tasks for a specific column
  const getColumnTasks = useCallback(
    (columnId: string): Task[] => {
      if (groupBy === 'driver') {
        // Filter tasks assigned to this driver
        const assignedTaskIds = taskAssignees
          .filter((ta) => ta.driver_id === columnId)
          .map((ta) => ta.task_id);
        return tasks.filter((t) => assignedTaskIds.includes(t.id));
      } else {
        // Filter tasks by status
        return tasks.filter((t) => t.status === columnId);
      }
    },
    [tasks, groupBy, taskAssignees]
  );

  // DnD event handlers
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    const taskId = active.id as string;
    
    // Find the task to display in DragOverlay
    const task = tasks.find((t) => t.id === taskId);
    setDraggedTask(task || null);
    setActiveId(taskId);
  }, [tasks]);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { over } = event;
    setOverId(over?.id as string | null);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    
    // Placeholder: no persistence yet
    // TODO: 7.1.4 - Handle actual reassignment/status update
    
    setActiveId(null);
    setOverId(null);
    setDraggedTask(null);
  }, []);

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-4">
        {/* Group toggle - Segmented control style */}
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700">קבץ לפי:</label>
          <div className="inline-flex rounded-lg border border-gray-300 bg-gray-100 p-1">
            <button
              onClick={() => setGroupBy('status')}
              className={`px-4 py-2 text-sm font-medium rounded transition-colors ${
                groupBy === 'status'
                  ? 'bg-white text-toyota-primary shadow-sm'
                  : 'text-gray-700 hover:text-gray-900'
              }`}
              aria-pressed={groupBy === 'status'}
            >
              סטטוס
            </button>
            <button
              onClick={() => setGroupBy('driver')}
              className={`px-4 py-2 text-sm font-medium rounded transition-colors ${
                groupBy === 'driver'
                  ? 'bg-white text-toyota-primary shadow-sm'
                  : 'text-gray-700 hover:text-gray-900'
              }`}
              aria-pressed={groupBy === 'driver'}
            >
              נהג
            </button>
          </div>
        </div>

        {/* Kanban board container */}
        <div
          className="h-[calc(100vh-200px)] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm"
          role="main"
          aria-label="לוח משימות"
        >
        {isLoading ? (
          // Loading skeletons - show 4 skeleton columns
          <div className="flex gap-6 overflow-x-auto p-4">
            {[1, 2, 3, 4].map((i) => (
              <ColumnSkeleton key={i} />
            ))}
          </div>
        ) : columns.length === 0 ? (
          // Empty state
          <div className="flex h-full w-full items-center justify-center">
            <div className="text-center">
              <p className="text-2xl mb-4">📭</p>
              <p className="text-lg font-semibold text-gray-700">אין עמודות להצגה</p>
              <p className="text-sm text-gray-500 mt-2">בדוק את הגדרות הקיבוץ שלך</p>
            </div>
          </div>
        ) : (
          // Kanban grid with horizontal scroll
          <div className="flex gap-6 overflow-x-auto p-4">
            {columns.map((column) => {
              const columnTasks = getColumnTasks(column.id);
              const isOver = overId === column.id;
              return (
                <KanbanColumn
                  key={column.id}
                  column={column}
                  tasks={columnTasks}
                  isOver={isOver}
                  activeTaskId={activeId}
                  taskAssigneeMap={taskAssigneeMap}
                  driverMap={driverMap}
                  clientMap={clientMap}
                  vehicleMap={vehicleMap}
                  onDragStart={handleDragStart}
                />
              );
            })}
          </div>
        )}
        </div>
      </div>

      {/* Drag overlay - renders the dragged task during drag */}
      <DragOverlay>
        {draggedTask && (
          <div className="rounded-lg border-2 border-toyota-primary bg-white p-3 shadow-xl opacity-95 w-80">
            <div className="mb-2 flex items-start justify-between gap-2">
              <h4 className="flex-1 line-clamp-2 font-semibold text-gray-900 text-sm">
                {draggedTask.title}
              </h4>
              <span className={`shrink-0 inline-block rounded-full px-1.5 py-0.5 text-xs font-bold text-white ${priorityColor(draggedTask.priority)}`}>
                {priorityLabel(draggedTask.priority)}
              </span>
            </div>
            <p className="mb-2 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
              {typeLabel(draggedTask.type)}
            </p>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

/**
 * ColumnSkeleton Component
 * Renders a skeleton loader for a column during data loading.
 */
function ColumnSkeleton() {
  return (
    <div className="flex min-w-[320px] flex-shrink-0 flex-col rounded-lg border-2 border-gray-200 bg-gray-50 animate-pulse">
      {/* Skeleton Header */}
      <div className="border-b border-gray-200 bg-white px-4 py-3">
        <div className="space-y-2">
          <div className="h-5 bg-gray-300 rounded w-24"></div>
          <div className="h-4 bg-gray-200 rounded w-16"></div>
        </div>
      </div>

      {/* Skeleton Tasks */}
      <div className="flex-1 space-y-3 p-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-lg bg-white p-3 space-y-2">
            <div className="h-4 bg-gray-300 rounded w-3/4"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            <div className="h-3 bg-gray-200 rounded w-2/3"></div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * KanbanColumn Component
 * Renders a single column in the Kanban board with header and task cards.
 */
interface KanbanColumnProps {
  column: { id: string; label: string; type: 'driver' | 'status' };
  tasks: Task[];
  isOver: boolean;
  activeTaskId: string | null;
  taskAssigneeMap: Map<string, TaskAssignee[]>;
  driverMap: Map<string, Driver>;
  clientMap: Map<string, Client>;
  vehicleMap: Map<string, Vehicle>;
  onDragStart: (event: DragStartEvent) => void;
}

function KanbanColumn({
  column,
  tasks,
  isOver,
  activeTaskId,
  taskAssigneeMap,
  driverMap,
  clientMap,
  vehicleMap,
  onDragStart,
}: KanbanColumnProps) {
  return (
    <div
      className={`flex min-w-[320px] flex-shrink-0 flex-col rounded-lg border-2 transition-all ${
        isOver
          ? 'border-toyota-primary/50 bg-toyota-50/30 shadow-md'
          : 'border-gray-200 bg-gray-50'
      }`}
      role="region"
      aria-label={`עמודה: ${column.label}`}
      data-drop-target={column.id}
    >
      {/* Column Header */}
      <div className="sticky top-0 border-b border-gray-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-gray-900">{column.label}</h3>
            <p className="text-xs font-medium text-gray-500">
              {tasks.length} {tasks.length === 1 ? 'משימה' : 'משימות'}
            </p>
          </div>
          <div className="rounded-full bg-gray-100 px-2.5 py-1 text-sm font-semibold text-gray-700">
            {tasks.length}
          </div>
        </div>
      </div>

      {/* Column Body - Scrollable task list */}
      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-2 text-2xl">📭</div>
            <p className="text-sm font-medium text-gray-400">אין משימות</p>
            <p className="text-xs text-gray-300">גרור משימה לכאן</p>
          </div>
        ) : (
          tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              columnId={column.id}
              isActive={activeTaskId === task.id}
              assignees={taskAssigneeMap.get(task.id) || []}
              driverMap={driverMap}
              clientMap={clientMap}
              vehicleMap={vehicleMap}
              onDragStart={onDragStart}
            />
          ))
        )}
      </div>
    </div>
  );
}

/**
 * TaskCard Component
 * Renders a single task card within the Kanban board with drag support.
 */
interface TaskCardProps {
  task: Task;
  columnId: string;
  isActive: boolean;
  assignees: TaskAssignee[];
  driverMap: Map<string, Driver>;
  clientMap: Map<string, Client>;
  vehicleMap: Map<string, Vehicle>;
  onDragStart: (event: DragStartEvent) => void;
}

function TaskCard({
  task,
  columnId,
  isActive,
  assignees,
  driverMap,
  clientMap,
  vehicleMap,
  onDragStart,
}: TaskCardProps) {
  const client = clientMap.get(task.client_id || '');
  const vehicle = vehicleMap.get(task.vehicle_id || '');
  const leadAssignee = assignees.find((a) => a.is_lead);
  const leadDriver = leadAssignee ? driverMap.get(leadAssignee.driver_id) : null;

  return (
    <div
      id={task.id}
      className={`cursor-grab active:cursor-grabbing rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition-all hover:shadow-md hover:border-gray-300 ${
        isActive ? 'opacity-50 ring-2 ring-toyota-primary' : ''
      }`}
      role="button"
      tabIndex={0}
      aria-label={`משימה: ${task.title}`}
      data-draggable-id={task.id}
    >
      {/* Header: Title + Priority Badge */}
      <div className="mb-2 flex items-start justify-between gap-2">
        <h4 className="flex-1 line-clamp-2 font-semibold text-gray-900 text-sm">{task.title}</h4>
        <span className={`shrink-0 inline-block rounded-full px-1.5 py-0.5 text-xs font-bold text-white ${priorityColor(task.priority)}`}>
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
          <span className="font-mono font-bold">{vehicle.license_plate}</span>
        </div>
      )}

      {/* Time window */}
      <div className="mb-2 text-xs text-gray-500">
        {formatDate(task.estimated_start)} - {formatDate(task.estimated_end)}
      </div>

      {/* Status badge */}
      <div className="inline-block">
        <span className={`inline-block rounded-full px-2 py-1 text-xs font-semibold ${statusColor(task.status)}`}>
          {statusLabel(task.status)}
        </span>
      </div>
    </div>
  );
}

/**
 * Utility functions for labels and colors
 */
function statusLabel(status: TaskStatus): string {
  const labels: Record<TaskStatus, string> = {
    pending: 'ממתין',
    in_progress: 'בתהליך',
    blocked: 'חסום',
    completed: 'הושלם',
  };
  return labels[status];
}

function statusColor(status: TaskStatus): string {
  const colors: Record<TaskStatus, string> = {
    pending: 'bg-gray-100 text-gray-800',
    in_progress: 'bg-blue-100 text-blue-800',
    blocked: 'bg-red-100 text-red-800',
    completed: 'bg-green-100 text-green-800',
  };
  return colors[status];
}

function priorityLabel(priority: TaskPriority): string {
  const labels: Record<TaskPriority, string> = {
    low: 'נמוך',
    medium: 'בינוני',
    high: 'גבוה',
  };
  return labels[priority];
}

function priorityColor(priority: TaskPriority): string {
  const colors: Record<TaskPriority, string> = {
    low: 'bg-gray-500',
    medium: 'bg-yellow-500',
    high: 'bg-red-600',
  };
  return colors[priority];
}

function typeLabel(type: TaskType): string {
  const labels: Record<TaskType, string> = {
    pickup_or_dropoff_car: 'איסוף/הורדת רכב',
    replacement_car_delivery: 'הסעת רכב חלופי',
    drive_client_home: 'הסעת לקוח הביתה',
    drive_client_to_dealership: 'הסעת לקוח למוסך',
    licence_test: 'בדיקת רישיון',
    rescue_stuck_car: 'חילוץ רכב תקוע',
    other: 'אחר',
  };
  return labels[type];
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('he-IL', { month: '2-digit', day: '2-digit' });
}

