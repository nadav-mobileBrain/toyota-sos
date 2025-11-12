'use client';

import React, { useState, useMemo, useCallback, Suspense, useEffect } from 'react';
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
  useDraggable,
  useDroppable,
  closestCorners,
} from '@dnd-kit/core';
const LazyTaskDialog = React.lazy(() => import('./TaskDialog').then((m) => ({ default: m.TaskDialog })));

/**
 * Type definitions for TasksBoard state and data structures
 */
export type TaskStatus = 'pending' | 'in_progress' | 'blocked' | 'completed';
export type TaskPriority = 'low' | 'medium' | 'high';
export type TaskType = 'pickup_or_dropoff_car' | 'replacement_car_delivery' | 'drive_client_home' | 'drive_client_to_dealership' | 'licence_test' | 'rescue_stuck_car' | 'other';
export type GroupBy = 'driver' | 'status';
export type SortBy = 'priority' | 'time' | 'driver';
export type SortDir = 'asc' | 'desc';

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
  const [assignees, setAssignees] = useState<TaskAssignee[]>(taskAssignees);
  // Persisted groupBy via URL query (?groupBy=driver|status) and localStorage
  const initialGroupBy = 'status' as GroupBy;
  const [groupBy, setGroupBy] = useState<GroupBy>(initialGroupBy);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
  const [dialogTask, setDialogTask] = useState<Task | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // Filters / search / sorting
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | TaskType>('all');
  const [filterPriority, setFilterPriority] = useState<'all' | TaskPriority>('all');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>('time');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  // Toasts
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  // Conflict ribbons (server-wins notifications)
  const [conflictByTaskId, setConflictByTaskId] = useState<Record<string, { by?: string | null; at?: string | null }>>({});

  // Configure drag-and-drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor),
    useSensor(TouchSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Sync groupBy to URL and localStorage
  const persistGroupBy = useCallback((next: GroupBy) => {
    setGroupBy(next);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem('tasksBoard.groupBy', next);
        const current = new URL(window.location.href);
        current.searchParams.set('groupBy', next);
        window.history.replaceState(null, '', `${current.pathname}?${current.searchParams.toString()}`);
      } catch {
        // no-op
      }
    }
  }, []);

  // Listen for conflict ribbons via BroadcastChannel from SW
  useEffect(() => {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return;
    const bc = new BroadcastChannel('sync-status');
    const timers = new Map<string, any>();
    bc.onmessage = (ev: MessageEvent) => {
      const msg = ev.data;
      if (msg && msg.type === 'conflict:server-wins' && msg.id) {
        setConflictByTaskId((prev) => ({ ...prev, [msg.id]: { by: msg.updatedBy || null, at: msg.updatedAt || null } }));
        // auto-clear after 10s
        if (timers.has(msg.id)) {
          clearTimeout(timers.get(msg.id));
        }
        const t = setTimeout(() => {
          setConflictByTaskId((prev) => {
            const next = { ...prev };
            delete next[msg.id];
            return next;
          });
        }, 10000);
        timers.set(msg.id, t);
      }
    };
    return () => {
      try { bc.close(); } catch {}
      timers.forEach((t) => clearTimeout(t));
    };
  }, []);

  // On mount, if URL lacks groupBy but localStorage has it, sync URL (and state) to stored
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    const hasParam = url.searchParams.has('groupBy');
    const stored = window.localStorage.getItem('tasksBoard.groupBy') as GroupBy | null;
    if (!hasParam && (stored === 'driver' || stored === 'status')) {
      persistGroupBy(stored);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Create lookup maps
  const driverMap = useMemo(() => {
    const map = new Map<string, Driver>();
    drivers.forEach((d) => map.set(d.id, d));
    return map;
  }, [drivers]);

  const taskAssigneeMap = useMemo(() => {
    const map = new Map<string, TaskAssignee[]>();
    assignees.forEach((ta) => {
      if (!map.has(ta.task_id)) {
        map.set(ta.task_id, []);
      }
      map.get(ta.task_id)!.push(ta);
    });
    return map;
  }, [assignees]);

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

  // Compute filtered + sorted tasks snapshot
  const filteredSortedTasks = useMemo(() => {
    const now = Date.now();
    const normalized = search.trim().toLowerCase();
    const priorityRank: Record<TaskPriority, number> = { low: 1, medium: 2, high: 3 };

    let list = tasks.filter((t) => {
      if (filterType !== 'all' && t.type !== filterType) return false;
      if (filterPriority !== 'all' && t.priority !== filterPriority) return false;
      if (overdueOnly) {
        const end = new Date(t.estimated_end).getTime();
        if (!(end < now && t.status !== 'completed')) return false;
      }
      if (normalized) {
        const clientName = t.client_id ? (clientMap.get(t.client_id)?.name || '') : '';
        const vehiclePlate = t.vehicle_id ? (vehicleMap.get(t.vehicle_id)?.license_plate || '') : '';
        const hay = `${t.title} ${clientName} ${vehiclePlate}`.toLowerCase();
        if (!hay.includes(normalized)) return false;
      }
      return true;
    });

    list = list.slice().sort((a, b) => {
      if (sortBy === 'priority') {
        const diff = priorityRank[b.priority] - priorityRank[a.priority];
        return diff === 0 ? a.title.localeCompare(b.title) : diff;
      }
      if (sortBy === 'driver') {
        const la = (taskAssigneeMap.get(a.id)?.find((x) => x.is_lead)?.driver_id) || '';
        const lb = (taskAssigneeMap.get(b.id)?.find((x) => x.is_lead)?.driver_id) || '';
        const na = la ? (driverMap.get(la)?.name || '') : '';
        const nb = lb ? (driverMap.get(lb)?.name || '') : '';
        return na.localeCompare(nb);
      }
      // time (estimated_start)
      const ta = new Date(a.estimated_start).getTime();
      const tb = new Date(b.estimated_start).getTime();
      return (sortDir === 'asc' ? ta - tb : tb - ta) || a.title.localeCompare(b.title);
    });

    return list;
  }, [tasks, search, filterType, filterPriority, overdueOnly, sortBy, sortDir, clientMap, vehicleMap, driverMap, taskAssigneeMap]);

  // Compute columns based on groupBy mode
  const columns = useMemo(() => {
    if (groupBy === 'driver') {
      // Group by driver: create columns for each assigned driver
      const driverIds = new Set<string>();
      assignees.forEach((ta) => driverIds.add(ta.driver_id));
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
        const assignedTaskIds = assignees
          .filter((ta) => ta.driver_id === columnId)
          .map((ta) => ta.task_id);
        return filteredSortedTasks.filter((t) => assignedTaskIds.includes(t.id));
      } else {
        // Filter tasks by status
        return filteredSortedTasks.filter((t) => t.status === columnId);
      }
    },
    [filteredSortedTasks, groupBy, assignees]
  );

  // Dialog helpers
  const openCreateDialog = useCallback(() => {
    setDialogMode('create');
    setDialogTask(null);
    setDialogOpen(true);
  }, []);

  const openEditDialog = useCallback((task: Task) => {
    setDialogMode('edit');
    setDialogTask(task);
    setDialogOpen(true);
  }, []);

  const handleCreated = useCallback((created: Task, leadId?: string, coIds?: string[]) => {
    setTasks((prev) => [created, ...prev]);
    const inserts: TaskAssignee[] = [];
    if (leadId) {
      inserts.push({ id: `local-${created.id}-lead`, task_id: created.id, driver_id: leadId, is_lead: true, assigned_at: new Date().toISOString() });
    }
    (coIds || []).forEach((id) => {
      inserts.push({ id: `local-${created.id}-${id}`, task_id: created.id, driver_id: id, is_lead: false, assigned_at: new Date().toISOString() });
    });
    if (inserts.length > 0) setAssignees((prev) => [...prev, ...inserts]);
  }, []);

  const handleUpdated = useCallback((updated: Task) => {
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  }, []);

  const toggleSelected = useCallback((taskId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }, []);

  const selectAllInColumn = useCallback((columnId: string, checked: boolean) => {
    const ids = getColumnTasks(columnId).map((t) => t.id);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) ids.forEach((id) => next.add(id));
      else ids.forEach((id) => next.delete(id));
      return next;
    });
  }, [getColumnTasks]);

  // Bulk actions
  const bulkReassign = useCallback(async (driverId: string) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const prevAssignees = assignees;
    // optimistic
    setAssignees((prev) => {
      const withoutLeads = prev.filter((ta) => !ids.includes(ta.task_id) || !ta.is_lead);
      const adds: TaskAssignee[] = ids.map((taskId) => ({
        id: `local-${taskId}-${driverId}`,
        task_id: taskId,
        driver_id: driverId,
        is_lead: true,
        assigned_at: new Date().toISOString(),
      }));
      return [...withoutLeads, ...adds];
    });
    const results = await Promise.allSettled(
      ids.map((taskId) =>
        fetch(`/api/admin/tasks/${taskId}/assign`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ driver_id: driverId }),
        })
      )
    );
    const anyFailed = results.some((r) => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.ok));
    if (anyFailed) {
      setAssignees(prevAssignees);
      setToast({ message: 'שגיאה בהקצאת נהג', type: 'error' });
    } else {
      setToast({ message: 'נהג הוקצה בהצלחה', type: 'success' });
    }
  }, [assignees, selectedIds]);

  const bulkChangePriority = useCallback(async (priority: TaskPriority) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const prevTasks = tasks;
    // optimistic
    setTasks((prev) => prev.map((t) => (ids.includes(t.id) ? { ...t, priority } : t)));
    const results = await Promise.allSettled(
      ids.map((taskId) =>
        fetch(`/api/admin/tasks/${taskId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ priority }),
        })
      )
    );
    const anyFailed = results.some((r) => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.ok));
    if (anyFailed) {
      setTasks(prevTasks);
      setToast({ message: 'שגיאה בעדכון עדיפות', type: 'error' });
    } else {
      setToast({ message: 'עדיפות עודכנה', type: 'success' });
    }
  }, [tasks, selectedIds]);

  const bulkDelete = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const prevTasks = tasks;
    const prevAssignees = assignees;
    // optimistic
    setTasks((prev) => prev.filter((t) => !ids.includes(t.id)));
    setAssignees((prev) => prev.filter((ta) => !ids.includes(ta.task_id)));
    const results = await Promise.allSettled(
      ids.map((taskId) =>
        fetch(`/api/admin/tasks/${taskId}`, {
          method: 'DELETE',
        })
      )
    );
    const anyFailed = results.some((r) => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.ok));
    if (anyFailed) {
      setTasks(prevTasks);
      setAssignees(prevAssignees);
      setToast({ message: 'שגיאה במחיקה', type: 'error' });
    } else {
      setSelectedIds(new Set());
      setToast({ message: 'נמחקו משימות שנבחרו', type: 'success' });
    }
  }, [tasks, assignees, selectedIds]);

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
    
    setActiveId(null);
    setOverId(null);
    setDraggedTask(null);

    // If no drop target or same target, do nothing
    if (!over || active.id === over.id) {
      return;
    }

    const taskId = active.id as string;
    const targetColumnId = over.id as string;
    const task = tasks.find((t) => t.id === taskId);

    if (!task) return;

    let updatePayload: Partial<Task> = {};

    // Determine what changed based on groupBy mode and target column
    if (groupBy === 'status') {
      // Target column is a status
      const newStatus = targetColumnId as TaskStatus;
      if (task.status !== newStatus) {
        updatePayload.status = newStatus;
      }
    } else if (groupBy === 'driver') {
      // Target column is a driver - update task assignee
      const targetDriverId = targetColumnId;
      const currentAssignee = assignees.find((ta) => ta.task_id === taskId && ta.is_lead);
      if (currentAssignee?.driver_id === targetDriverId) {
        return;
      }
      // Optimistic assignees update and persistence with rollback
      const prevSnapshot = assignees;
      setAssignees((prevAssignees) => {
        const withoutLead = prevAssignees.filter((ta) => !(ta.task_id === taskId && ta.is_lead));
        const newLead: TaskAssignee = {
          id: `local-${taskId}`,
          task_id: taskId,
          driver_id: targetDriverId,
          is_lead: true,
          assigned_at: new Date().toISOString(),
        };
        return [...withoutLead, newLead];
      });
      persistDriverAssignment(taskId, targetDriverId, prevSnapshot);
      return;
    }

    // If no changes, return
    if (groupBy === 'status' && (Object.keys(updatePayload).length === 0 || !updatePayload.status)) {
      return;
    }

    // Optimistically update local state
    setTasks((prevTasks) =>
      prevTasks.map((t) =>
        t.id === taskId
          ? { ...t, ...updatePayload }
          : t
      )
    );

    // Persist to database via API
    if (updatePayload.status) {
      persistTaskUpdate(taskId, { status: updatePayload.status });
    }

    // If changing driver assignment, also persist that
    if (groupBy === 'driver' && taskAssignees.some((ta) => ta.task_id === taskId)) {
      persistDriverAssignment(taskId, targetColumnId);
    }
  }, [tasks, taskAssignees, groupBy]);

  // Persist task status update to database
  const persistTaskUpdate = useCallback(
    async (taskId: string, update: Partial<Task>) => {
      try {
        const response = await fetch(`/api/admin/tasks/${taskId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(update),
        });

        if (!response.ok) {
          console.error('Failed to update task:', response.statusText);
          // Revert optimistic update on error
          setTasks((prevTasks) =>
            prevTasks.map((t) =>
              t.id === taskId
                ? initialTasks.find((it) => it.id === taskId) || t
                : t
            )
          );
          setToast({ message: 'שגיאה בעדכון משימה', type: 'error' });
        } else {
          setToast({ message: 'המשימה עודכנה', type: 'success' });
        }
      } catch (error) {
        console.error('Error persisting task update:', error);
        // Revert optimistic update on error
        setTasks((prevTasks) =>
          prevTasks.map((t) =>
            t.id === taskId
              ? initialTasks.find((it) => it.id === taskId) || t
              : t
          )
        );
        setToast({ message: 'שגיאה בעדכון משימה', type: 'error' });
      }
    },
    [initialTasks]
  );

  // Persist driver assignment update to database
  const persistDriverAssignment = useCallback(
    async (taskId: string, newDriverId: string, prevSnapshot?: TaskAssignee[]) => {
      try {
        const response = await fetch(`/api/admin/tasks/${taskId}/assign`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ driver_id: newDriverId }),
        });

        if (!response.ok) {
          console.error('Failed to update driver assignment:', response.statusText);
          if (prevSnapshot) {
            setAssignees(prevSnapshot);
          }
          setToast({ message: 'שגיאה בהקצאת נהג', type: 'error' });
        } else {
          setToast({ message: 'נהג עודכן', type: 'success' });
        }
      } catch (error) {
        console.error('Error persisting driver assignment:', error);
        if (prevSnapshot) {
          setAssignees(prevSnapshot);
        }
        setToast({ message: 'שגיאה בהקצאת נהג', type: 'error' });
      }
    },
    []
  );

  // Realtime updates (tasks, task_assignees)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Lazy load browser client to avoid SSR issues
    let supa: any;
    (async () => {
      try {
        const { createBrowserClient } = await import('@/lib/auth');
        supa = createBrowserClient();
        const channel = supa
          .channel('realtime:admin-tasks')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, (payload: any) => {
            setTasks((prev) => {
              if (payload.eventType === 'INSERT') {
                const row = payload.new as Task;
                if (prev.find((t) => t.id === row.id)) return prev;
                return [row, ...prev];
              }
              if (payload.eventType === 'UPDATE') {
                const row = payload.new as Task;
                return prev.map((t) => (t.id === row.id ? { ...t, ...row } : t));
              }
              if (payload.eventType === 'DELETE') {
                const row = payload.old as Task;
                return prev.filter((t) => t.id !== row.id);
              }
              return prev;
            });
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'task_assignees' }, (payload: any) => {
            setAssignees((prev) => {
              if (payload.eventType === 'INSERT') {
                const row = payload.new as TaskAssignee;
                if (prev.find((a) => a.id === row.id)) return prev;
                return [...prev, row];
              }
              if (payload.eventType === 'UPDATE') {
                const row = payload.new as TaskAssignee;
                return prev.map((a) => (a.id === row.id ? { ...a, ...row } : a));
              }
              if (payload.eventType === 'DELETE') {
                const row = payload.old as TaskAssignee;
                return prev.filter((a) => a.id !== row.id);
              }
              return prev;
            });
          })
          .subscribe();
        // Cleanup
        return () => {
          try { channel && supa.removeChannel(channel); } catch { /* no-op */ }
        };
      } catch {
        // no-op
      }
    })();
    return () => { /* channel cleanup in inner func */ };
  }, []);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-4">
        {/* Group toggle - Segmented control style */}
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700">קבץ לפי:</label>
        <div className="inline-flex rounded-lg border border-gray-300 bg-gray-100 p-1" role="group" aria-label="קבץ לפי">
            <button
            onClick={() => persistGroupBy('status')}
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
            onClick={() => persistGroupBy('driver')}
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

          <button
            onClick={openCreateDialog}
            className="ml-auto rounded bg-toyota-primary px-3 py-2 text-sm font-semibold text-white hover:bg-toyota-primary/90"
          >
            משימה חדשה
          </button>
        </div>

        {/* Kanban board container */}
        <div
          className="h-[calc(100vh-200px)] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm"
          role="main"
          aria-label="לוח משימות"
        >
        {/* Filters & Search & Sort */}
        <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 px-4 py-2 bg-white">
          <input
            type="text"
            placeholder="חפש משימות (כותרת / לקוח / רכב)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64 rounded border border-gray-300 px-2 py-1 text-sm"
          />
          <select
            className="rounded border border-gray-300 px-2 py-1 text-sm"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
          >
            <option value="all">כל הסוגים</option>
            <option value="pickup_or_dropoff_car">סוג: איסוף/הורדת רכב</option>
            <option value="replacement_car_delivery">סוג: הסעת רכב חלופי</option>
            <option value="drive_client_home">סוג: הסעת לקוח הביתה</option>
            <option value="drive_client_to_dealership">סוג: הסעת לקוח למוסך</option>
            <option value="licence_test">סוג: בדיקת רישיון</option>
            <option value="rescue_stuck_car">סוג: חילוץ רכב תקוע</option>
            <option value="other">סוג: אחר</option>
          </select>
          <select
            className="rounded border border-gray-300 px-2 py-1 text-sm"
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value as any)}
          >
            <option value="all">כל העדיפויות</option>
            <option value="low">עדיפות: נמוך</option>
            <option value="medium">עדיפות: בינוני</option>
            <option value="high">עדיפות: גבוה</option>
          </select>
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={overdueOnly} onChange={(e) => setOverdueOnly(e.target.checked)} />
            באיחור בלבד
          </label>
          <div className="ml-auto flex items-center gap-2">
            <select
              className="rounded border border-gray-300 px-2 py-1 text-sm"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
            >
              <option value="time">זמן</option>
              <option value="priority">עדיפות</option>
              <option value="driver">נהג</option>
            </select>
            {sortBy === 'time' && (
              <select
                className="rounded border border-gray-300 px-2 py-1 text-sm"
                value={sortDir}
                onChange={(e) => setSortDir(e.target.value as SortDir)}
              >
                <option value="asc">מהקודם לאחרון</option>
                <option value="desc">מהאחרון לקודם</option>
              </select>
            )}
          </div>
        </div>
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
          <>
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-3 border-b border-gray-200 bg-gray-50 px-4 py-2">
                <span className="text-sm text-gray-700">נבחרו {selectedIds.size}</span>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-600">הקצה נהג:</label>
                  <select
                    className="rounded border border-gray-300 p-1 text-sm"
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val) {
                        bulkReassign(val);
                        e.currentTarget.selectedIndex = 0;
                      }
                    }}
                  >
                    <option value="">בחר</option>
                    {drivers.map((d) => (
                      <option key={d.id} value={d.id}>{d.name || d.email}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-600">עדיפות:</label>
                  <select
                    className="rounded border border-gray-300 p-1 text-sm"
                    onChange={(e) => {
                      const val = e.target.value as TaskPriority;
                      if (val) {
                        bulkChangePriority(val);
                        e.currentTarget.selectedIndex = 0;
                      }
                    }}
                  >
                    <option value="">בחר</option>
                    <option value="low">נמוך</option>
                    <option value="medium">בינוני</option>
                    <option value="high">גבוה</option>
                  </select>
                </div>
                <button
                  className="ml-auto rounded border border-red-300 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-100"
                  onClick={() => {
                    if (confirm('למחוק את המשימות שנבחרו?')) bulkDelete();
                  }}
                >
                  מחק נבחרים
                </button>
              </div>
            )}
            {/* Kanban grid with horizontal scroll */}
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
                    selectedIds={selectedIds}
                    taskAssigneeMap={taskAssigneeMap}
                    driverMap={driverMap}
                    clientMap={clientMap}
                    vehicleMap={vehicleMap}
                    conflict={conflictByTaskId}
                    onDragStart={handleDragStart}
                    toggleSelected={toggleSelected}
                    selectAllInColumn={selectAllInColumn}
                  />
                );
              })}
            </div>
          </>
        )}
        </div>
        {/* Toast */}
        {toast && (
          <div
            className={`fixed bottom-4 right-4 rounded px-4 py-2 text-white shadow ${
              toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
            }`}
            role="status"
            aria-live="polite"
            onAnimationEnd={() => {}}
          >
            <span>{toast.message}</span>
          </div>
        )}
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
      {/* Task Dialog */}
      {dialogOpen && (
        <Suspense fallback={null}>
          <LazyTaskDialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            mode={dialogMode}
            task={dialogTask}
            drivers={drivers}
            clients={clients}
            vehicles={vehicles}
            onCreated={handleCreated}
            onUpdated={handleUpdated}
          />
        </Suspense>
      )}
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
  selectedIds: Set<string>;
  taskAssigneeMap: Map<string, TaskAssignee[]>;
  driverMap: Map<string, Driver>;
  clientMap: Map<string, Client>;
  vehicleMap: Map<string, Vehicle>;
  conflict: Record<string, { by?: string | null; at?: string | null }>;
  onDragStart: (event: DragStartEvent) => void;
  toggleSelected: (taskId: string) => void;
  selectAllInColumn: (columnId: string, checked: boolean) => void;
}

function KanbanColumn({
  column,
  tasks,
  isOver,
  activeTaskId,
  selectedIds,
  taskAssigneeMap,
  driverMap,
  clientMap,
  vehicleMap,
  conflict,
  onDragStart,
  toggleSelected,
  selectAllInColumn,
}: KanbanColumnProps) {
  // Setup droppable
  const { setNodeRef } = useDroppable({
    id: column.id,
    data: { type: column.type },
  });

  return (
    <div
      ref={setNodeRef}
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
        <div className="mt-2 flex items-center justify-between">
          <label className="inline-flex items-center gap-2 text-xs text-gray-600">
            <input
              type="checkbox"
              onChange={(e) => selectAllInColumn(column.id, e.target.checked)}
            />
            בחר הכל
          </label>
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
              conflictInfo={conflict[task.id]}
              onDragStart={onDragStart}
              onEdit={() => {}}
              selected={selectedIds.has(task.id)}
              onToggleSelected={() => toggleSelected(task.id)}
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
  conflictInfo?: { by?: string | null; at?: string | null };
  onDragStart: (event: DragStartEvent) => void;
  onEdit: (task: Task) => void;
  selected: boolean;
  onToggleSelected: () => void;
}

function TaskCard({
  task,
  columnId,
  isActive,
  assignees,
  driverMap,
  clientMap,
  vehicleMap,
  conflictInfo,
  onDragStart,
  onEdit,
  selected,
  onToggleSelected,
}: TaskCardProps) {
  const client = clientMap.get(task.client_id || '');
  const vehicle = vehicleMap.get(task.vehicle_id || '');
  const leadAssignee = assignees.find((a) => a.is_lead);
  const leadDriver = leadAssignee ? driverMap.get(leadAssignee.driver_id) : null;

  // Setup draggable
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
    data: { type: 'task', taskId: task.id, sourceColumn: columnId },
  });

  return (
    <div
      ref={setNodeRef}
      id={task.id}
      className={`relative cursor-grab active:cursor-grabbing rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition-all hover:shadow-md hover:border-gray-300 ${
        isActive ? 'opacity-50 ring-2 ring-toyota-primary' : ''
      } ${isDragging ? 'opacity-50' : ''}`}
      aria-label={`משימה: ${task.title}`}
      data-draggable-id={task.id}
      {...attributes}
      {...listeners}
    >
      {conflictInfo && (
        <div className="absolute -top-2 -left-2 rounded bg-orange-500 px-2 py-0.5 text-[10px] font-semibold text-white shadow">
          עודכן ע"י {conflictInfo.by || 'שרת'} {conflictInfo.at ? `(${new Date(conflictInfo.at).toLocaleTimeString()})` : ''}
        </div>
      )}
      {/* Header: Select + Title + Priority Badge */}
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <input type="checkbox" checked={selected} onChange={onToggleSelected} aria-label="בחר משימה" />
          <h4 className="flex-1 line-clamp-2 font-semibold text-gray-900 text-sm">{task.title}</h4>
        </div>
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

      {/* Footer: Status + Actions */}
      <div className="mt-2 flex items-center justify-between">
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${statusColor(task.status)}`}>
          {statusLabel(task.status)}
        </span>
        <button className="text-xs text-toyota-primary hover:underline" onClick={() => onEdit(task)}>
          עריכה
        </button>
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

