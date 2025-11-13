'use client';

/* eslint-disable max-lines */
import React, {
  useState,
  useMemo,
  useCallback,
  Suspense,
  useEffect,
} from 'react';
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
  useDroppable,
  closestCorners,
} from '@dnd-kit/core';
import {
  trackTaskAssigned,
  trackTaskCreated,
  trackTaskStatusChange,
} from '@/lib/events';
const LazyTaskDialog = React.lazy(() =>
  import('./TaskDialog').then((m) => ({ default: m.TaskDialog }))
);
import { useFeatureFlag } from '@/lib/useFeatureFlag';
import { FLAG_BULK_OPS } from '@/lib/flagKeys';
import { toastSuccess, toastError } from '@/lib/toast';
import type {
  Task,
  TaskStatus,
  TaskPriority,
  TaskType,
  TaskAssignee,
} from '@/types/task';
import type { Driver } from '@/types/user';
import type { Client, Vehicle } from '@/types/entity';
import type {
  GroupBy,
  SortBy,
  SortDir,
  TasksBoardProps,
  KanbanColumnProps,
} from '@/types/board';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  TaskCard,
  statusLabel,
  priorityColor,
  priorityLabel,
  typeLabel,
} from './TaskCard';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

type PostgresChangePayload = {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new?: unknown;
  old?: unknown;
  schema: string;
  table: string;
};

// Re-export types for backward compatibility
export type {
  Task,
  TaskStatus,
  TaskPriority,
  TaskType,
  TaskAssignee,
  Driver,
  Client,
  Vehicle,
  GroupBy,
  SortBy,
  SortDir,
  TasksBoardProps,
};

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
  const [isLoading] = useState(false);
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
  const [dialogTask, setDialogTask] = useState<Task | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // Filters / search / sorting
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | TaskType>('all');
  const [filterPriority, setFilterPriority] = useState<'all' | TaskPriority>(
    'all'
  );
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>('time');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  // Conflict ribbons (server-wins notifications)
  const [conflictByTaskId, setConflictByTaskId] = useState<
    Record<string, { by?: string | null; at?: string | null }>
  >({});

  // Feature flags
  const bulkEnabled = useFeatureFlag(FLAG_BULK_OPS);

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

  // (handleDragEnd declared below, after persistence helpers)

  // Sync groupBy to URL and localStorage
  const persistGroupBy = useCallback((next: GroupBy) => {
    setGroupBy(next);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem('tasksBoard.groupBy', next);
        const current = new URL(window.location.href);
        current.searchParams.set('groupBy', next);
        window.history.replaceState(
          null,
          '',
          `${current.pathname}?${current.searchParams.toString()}`
        );
      } catch {
        // no-op
      }
    }
  }, []);

  // Listen for conflict ribbons via BroadcastChannel from SW
  useEffect(() => {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window))
      return;
    const bc = new BroadcastChannel('sync-status');
    const timers = new Map<string, ReturnType<typeof setTimeout>>();
    bc.onmessage = (ev: MessageEvent) => {
      const msg = ev.data;
      if (msg && msg.type === 'conflict:server-wins' && msg.id) {
        setConflictByTaskId((prev) => ({
          ...prev,
          [msg.id]: { by: msg.updatedBy || null, at: msg.updatedAt || null },
        }));
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
      try {
        bc.close();
      } catch {}
      timers.forEach((t) => clearTimeout(t));
    };
  }, []);

  // On mount, if URL lacks groupBy but localStorage has it, sync URL (and state) to stored
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    const hasParam = url.searchParams.has('groupBy');
    const stored = window.localStorage.getItem(
      'tasksBoard.groupBy'
    ) as GroupBy | null;
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
    const priorityRank: Record<TaskPriority, number> = {
      נמוכה: 1,
      בינונית: 2,
      גבוהה: 3,
    };

    let list = tasks.filter((t) => {
      if (filterType !== 'all' && t.type !== filterType) return false;
      if (filterPriority !== 'all' && t.priority !== filterPriority)
        return false;
      if (overdueOnly) {
        const end = new Date(t.estimated_end).getTime();
        if (!(end < now && t.status !== 'הושלמה')) return false;
      }
      if (normalized) {
        const clientName = t.client_id
          ? clientMap.get(t.client_id)?.name || ''
          : '';
        const vehiclePlate = t.vehicle_id
          ? vehicleMap.get(t.vehicle_id)?.license_plate || ''
          : '';
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
        const la =
          taskAssigneeMap.get(a.id)?.find((x) => x.is_lead)?.driver_id || '';
        const lb =
          taskAssigneeMap.get(b.id)?.find((x) => x.is_lead)?.driver_id || '';
        const na = la ? driverMap.get(la)?.name || '' : '';
        const nb = lb ? driverMap.get(lb)?.name || '' : '';
        return na.localeCompare(nb);
      }
      // time (estimated_start)
      const ta = new Date(a.estimated_start).getTime();
      const tb = new Date(b.estimated_start).getTime();
      return (
        (sortDir === 'asc' ? ta - tb : tb - ta) ||
        a.title.localeCompare(b.title)
      );
    });

    return list;
  }, [
    tasks,
    search,
    filterType,
    filterPriority,
    overdueOnly,
    sortBy,
    sortDir,
    clientMap,
    vehicleMap,
    driverMap,
    taskAssigneeMap,
  ]);

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
      const statuses: TaskStatus[] = ['בהמתנה', 'בעבודה', 'חסומה', 'הושלמה'];
      return statuses.map((status) => ({
        id: status,
        label: statusLabel(status),
        type: 'status' as const,
      }));
    }
  }, [groupBy, assignees, driverMap]);

  // Get tasks for a specific column
  const getColumnTasks = useCallback(
    (columnId: string): Task[] => {
      if (groupBy === 'driver') {
        // Filter tasks assigned to this driver
        const assignedTaskIds = assignees
          .filter((ta) => ta.driver_id === columnId)
          .map((ta) => ta.task_id);
        return filteredSortedTasks.filter((t) =>
          assignedTaskIds.includes(t.id)
        );
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

  const handleCreated = useCallback(
    (created: Task, leadId?: string, coIds?: string[]) => {
      setTasks((prev) => [created, ...prev]);
      const inserts: TaskAssignee[] = [];
      if (leadId) {
        inserts.push({
          id: `local-${created.id}-lead`,
          task_id: created.id,
          driver_id: leadId,
          is_lead: true,
          assigned_at: new Date().toISOString(),
        });
      }
      (coIds || []).forEach((id) => {
        inserts.push({
          id: `local-${created.id}-${id}`,
          task_id: created.id,
          driver_id: id,
          is_lead: false,
          assigned_at: new Date().toISOString(),
        });
      });
      if (inserts.length > 0) setAssignees((prev) => [...prev, ...inserts]);
      // Toast is shown in TaskDialog, no need to show it here
      try {
        trackTaskCreated(created, leadId);
      } catch {}
    },
    []
  );

  // DnD: finalize drop and persist changes

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

  const selectAllInColumn = useCallback(
    (columnId: string, checked: boolean) => {
      const ids = getColumnTasks(columnId).map((t) => t.id);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (checked) ids.forEach((id) => next.add(id));
        else ids.forEach((id) => next.delete(id));
        return next;
      });
    },
    [getColumnTasks]
  );

  // Bulk actions
  const bulkReassign = useCallback(
    async (driverId: string) => {
      const ids = Array.from(selectedIds);
      if (ids.length === 0) return;
      const prevAssignees = assignees;
      // optimistic
      setAssignees((prev) => {
        const withoutLeads = prev.filter(
          (ta) => !ids.includes(ta.task_id) || !ta.is_lead
        );
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
      const anyFailed = results.some(
        (r) =>
          r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.ok)
      );
      if (anyFailed) {
        setAssignees(prevAssignees);
        toastError('שגיאה בהקצאת נהג');
      } else {
        toastSuccess('נהג הוקצה בהצלחה');
      }
    },
    [assignees, selectedIds]
  );

  const bulkChangePriority = useCallback(
    async (priority: TaskPriority) => {
      const ids = Array.from(selectedIds);
      if (ids.length === 0) return;
      const prevTasks = tasks;
      // optimistic
      setTasks((prev) =>
        prev.map((t) => (ids.includes(t.id) ? { ...t, priority } : t))
      );
      const results = await Promise.allSettled(
        ids.map((taskId) =>
          fetch(`/api/admin/tasks/${taskId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ priority }),
          })
        )
      );
      const anyFailed = results.some(
        (r) =>
          r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.ok)
      );
      if (anyFailed) {
        setTasks(prevTasks);
        toastError('שגיאה בעדכון עדיפות');
      } else {
        toastSuccess('עדיפות עודכנה');
      }
    },
    [tasks, selectedIds]
  );

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
    const anyFailed = results.some(
      (r) =>
        r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.ok)
    );
    if (anyFailed) {
      setTasks(prevTasks);
      setAssignees(prevAssignees);
      toastError('שגיאה במחיקה');
    } else {
      setSelectedIds(new Set());
      toastSuccess('נמחקו משימות שנבחרו');
    }
  }, [tasks, assignees, selectedIds]);

  // DnD event handlers
  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const { active } = event;
      const taskId = active.id as string;

      // Find the task to display in DragOverlay
      const task = tasks.find((t) => t.id === taskId);
      setDraggedTask(task || null);
      setActiveId(taskId);
    },
    [tasks]
  );

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { over } = event;
    setOverId(over?.id as string | null);
  }, []);

  // handleDragEnd is declared after persistence helpers to satisfy lints

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
          toastError('שגיאה בעדכון משימה');
        } else {
          toastSuccess('המשימה עודכנה');
          try {
            // Find the latest task snapshot
            setTasks((prev) => {
              const t = prev.find((x) => x.id === taskId);
              if (t && (update as unknown as Task).status) {
                trackTaskStatusChange(
                  { ...t, updated_at: new Date().toISOString() },
                  (update as unknown as Task).status as string
                );
              }
              return prev;
            });
          } catch {}
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
        toastError('שגיאה בעדכון משימה');
      }
    },
    [initialTasks]
  );

  // Persist driver assignment update to database
  const persistDriverAssignment = useCallback(
    async (
      taskId: string,
      newDriverId: string,
      prevSnapshot?: TaskAssignee[]
    ) => {
      try {
        const response = await fetch(`/api/admin/tasks/${taskId}/assign`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ driver_id: newDriverId }),
        });

        if (!response.ok) {
          console.error(
            'Failed to update driver assignment:',
            response.statusText
          );
          if (prevSnapshot) {
            setAssignees(prevSnapshot);
          }
          toastError('שגיאה בהקצאת נהג');
        } else {
          toastSuccess('נהג עודכן');
          try {
            const t = tasks.find((x) => x.id === taskId);
            if (t) trackTaskAssigned(t, newDriverId);
          } catch {}
        }
      } catch (error) {
        console.error('Error persisting driver assignment:', error);
        if (prevSnapshot) {
          setAssignees(prevSnapshot);
        }
        toastError('שגיאה בהקצאת נהג');
      }
    },
    [tasks]
  );

  // DnD: finalize drop and persist changes
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);
      setOverId(null);
      setDraggedTask(null);
      if (!over || active.id === over.id) return;
      const taskId = active.id as string;
      const targetColumnId = over.id as string;
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;
      const updatePayload: Partial<Task> = {};
      if (groupBy === 'status') {
        const newStatus = targetColumnId as TaskStatus;
        if (task.status !== newStatus) updatePayload.status = newStatus;
      } else if (groupBy === 'driver') {
        const targetDriverId = targetColumnId;
        const currentAssignee = assignees.find(
          (ta) => ta.task_id === taskId && ta.is_lead
        );
        if (currentAssignee?.driver_id === targetDriverId) return;
        const prevSnapshot = assignees;
        setAssignees((prevAssignees) => {
          const withoutLead = prevAssignees.filter(
            (ta) => !(ta.task_id === taskId && ta.is_lead)
          );
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
      if (
        groupBy === 'status' &&
        (Object.keys(updatePayload).length === 0 || !updatePayload.status)
      )
        return;
      setTasks((prevTasks) =>
        prevTasks.map((t) => (t.id === taskId ? { ...t, ...updatePayload } : t))
      );
      if (updatePayload.status) {
        persistTaskUpdate(taskId, { status: updatePayload.status });
      }
    },
    [tasks, assignees, groupBy, persistDriverAssignment, persistTaskUpdate]
  );

  // Realtime updates (tasks, task_assignees)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Lazy load browser client to avoid SSR issues
    let supa: SupabaseClient;
    (async () => {
      try {
        const { createBrowserClient } = await import('@/lib/auth');
        supa = createBrowserClient();
        const channel = supa
          .channel('realtime:admin-tasks')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'tasks' },
            (payload: PostgresChangePayload) => {
              setTasks((prev) => {
                if (payload.eventType === 'INSERT') {
                  const row = payload.new as Task;
                  if (prev.find((t) => t.id === row.id)) return prev;
                  return [row, ...prev];
                }
                if (payload.eventType === 'UPDATE') {
                  const row = payload.new as Task;
                  return prev.map((t) =>
                    t.id === row.id ? { ...t, ...row } : t
                  );
                }
                if (payload.eventType === 'DELETE') {
                  const row = payload.old as Task;
                  return prev.filter((t) => t.id !== row.id);
                }
                return prev;
              });
            }
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'task_assignees' },
            (payload: PostgresChangePayload) => {
              setAssignees((prev) => {
                if (payload.eventType === 'INSERT') {
                  const row = payload.new as TaskAssignee;
                  if (prev.find((a) => a.id === row.id)) return prev;
                  return [...prev, row];
                }
                if (payload.eventType === 'UPDATE') {
                  const row = payload.new as TaskAssignee;
                  return prev.map((a) =>
                    a.id === row.id ? { ...a, ...row } : a
                  );
                }
                if (payload.eventType === 'DELETE') {
                  const row = payload.old as TaskAssignee;
                  return prev.filter((a) => a.id !== row.id);
                }
                return prev;
              });
            }
          )
          .subscribe();
        // Cleanup
        return () => {
          try {
            if (channel) supa.removeChannel(channel);
          } catch {
            /* no-op */
          }
        };
      } catch {
        // no-op
      }
    })();
    return () => {
      /* channel cleanup in inner func */
    };
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
          <div
            className="inline-flex rounded-lg border border-gray-300 bg-gray-100 p-1"
            role="group"
            aria-label="קבץ לפי"
          >
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
          className="h-[calc(100vh-200px)] min-h-0 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm"
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
            {(() => {
              const typeOptions: Array<{
                value: 'all' | TaskType;
                label: string;
              }> = [
                { value: 'all', label: 'כל הסוגים' },
                { value: 'איסוף/הורדת רכב', label: 'איסוף/הורדת רכב' },
                { value: 'הסעת רכב חלופי', label: 'הסעת רכב חלופי' },
                { value: 'הסעת לקוח הביתה', label: 'הסעת לקוח הביתה' },
                { value: 'הסעת לקוח למוסך', label: 'הסעת לקוח למוסך' },
                { value: 'ביצוע טסט', label: 'ביצוע טסט' },
                { value: 'חילוץ רכב תקוע', label: 'חילוץ רכב תקוע' },
                { value: 'אחר', label: 'אחר' },
              ];
              const currentLabel =
                typeOptions.find((o) => o.value === filterType)?.label ||
                'כל הסוגים';
              return (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className="text-sm font-normal justify-start"
                    >
                      {currentLabel}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    className="w-56 bg-white text-right *:text-right"
                    style={{ direction: 'rtl' }}
                  >
                    <DropdownMenuRadioGroup
                      value={filterType}
                      onValueChange={(value) =>
                        setFilterType(value as 'all' | TaskType)
                      }
                    >
                      {typeOptions.map(({ value, label }) => (
                        <DropdownMenuRadioItem
                          key={value as string}
                          value={value as string}
                          className="hover:bg-blue-600 hover:text-white"
                        >
                          {label}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              );
            })()}
            <select
              className="rounded border border-gray-300 px-2 py-1 text-sm"
              value={filterPriority}
              onChange={(e) =>
                setFilterPriority(e.target.value as 'all' | TaskPriority)
              }
            >
              <option value="all">כל העדיפויות</option>
              <option value="low">עדיפות: נמוך</option>
              <option value="medium">עדיפות: בינוני</option>
              <option value="high">עדיפות: גבוה</option>
            </select>
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={overdueOnly}
                onChange={(e) => setOverdueOnly(e.target.checked)}
              />
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
                <p className="text-lg font-semibold text-gray-700">
                  אין עמודות להצגה
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  בדוק את הגדרות הקיבוץ שלך
                </p>
              </div>
            </div>
          ) : (
            <>
              {bulkEnabled && selectedIds.size > 0 && (
                <div className="flex items-center gap-3 border-b border-gray-200 bg-gray-50 px-4 py-2">
                  <span className="text-sm text-gray-700">
                    נבחרו {selectedIds.size}
                  </span>
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
                        <option key={d.id} value={d.id}>
                          {d.name || d.email}
                        </option>
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
              <div className="flex h-full gap-6 overflow-x-auto p-4">
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
                      bulkEnabled={!!bulkEnabled}
                    />
                  );
                })}
              </div>
            </>
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
              <span
                className={`shrink-0 inline-block rounded-full px-1.5 py-0.5 text-xs font-bold text-white ${priorityColor(
                  draggedTask.priority
                )}`}
              >
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
    <div className="flex min-w-[320px] shrink-0 flex-col rounded-lg border-2 border-gray-200 bg-gray-50 animate-pulse">
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
  bulkEnabled,
}: KanbanColumnProps) {
  // Setup droppable
  const { setNodeRef } = useDroppable({
    id: column.id,
    data: { type: column.type },
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex h-full min-h-0 min-w-[320px] shrink-0 flex-col rounded-lg border-2 transition-all ${
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
            <h3 className="font-bold text-blue-700 underline text-xl">
              {column.label}
            </h3>
            <p className="text-xs font-medium text-gray-500">
              {tasks.length} {tasks.length === 1 ? 'משימה' : 'משימות'}
            </p>
          </div>
          <div className="rounded-full bg-gray-100 px-2.5 py-1 text-sm font-semibold text-gray-700">
            {tasks.length}
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between">
          {bulkEnabled && (
            <label className="inline-flex items-center gap-2 text-xs text-gray-600">
              <input
                type="checkbox"
                onChange={(e) => selectAllInColumn(column.id, e.target.checked)}
              />
              בחר הכל
            </label>
          )}
        </div>
      </div>

      {/* Column Body - Scrollable task list */}
      <div className="flex-1 space-y-3 overflow-y-auto p-3 pb-10">
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
              showSelect={bulkEnabled}
            />
          ))
        )}
      </div>
    </div>
  );
}
