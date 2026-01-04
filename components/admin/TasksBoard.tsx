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
import type { Client, Vehicle, ClientVehicle } from '@/types/entity';
import type { GroupBy, SortBy, SortDir, TasksBoardProps } from '@/types/board';
import { usePeriod } from '@/components/admin/dashboard/PeriodContext';
import {
  statusLabel,
  priorityColor,
  priorityLabel,
  typeLabel,
} from '@/lib/task-utils';
import { useAuth } from '@/components/AuthProvider';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { ArrowUpDownIcon, ListIcon, PlusIcon, UsersIcon } from 'lucide-react';
import { ColumnSkeleton } from './ColumnSkeleton';
import { KanbanColumn } from './KanbanColumn';
import {
  buildClientMap,
  buildDriverMap,
  buildTaskAssigneeMap,
  buildVehicleMap,
  buildClientVehicleMap,
  computeColumns,
  filterTasks,
  getColumnTasks as getColumnTasksUtil,
  sortTasks,
} from '@/utils/admin/tasksBoardMappers';

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
  ClientVehicle,
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
  clientVehicles,
  driverBreaks = {},
}: TasksBoardProps) {
  // Get the shared authenticated client from context
  const { client: supabaseClient } = useAuth();
  
  // State management
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [assignees, setAssignees] = useState<TaskAssignee[]>(taskAssignees);
  const [vehiclesState, setVehiclesState] = useState<Vehicle[]>(vehicles);
  const [clientsState, setClientsState] = useState<Client[]>(clients);
  const [clientVehiclesState, setClientVehiclesState] =
    useState<ClientVehicle[]>(clientVehicles);
  const [driverBreaksState, setDriverBreaksState] =
    useState<Record<string, boolean>>(driverBreaks);
  // Persisted groupBy via URL query (?groupBy=driver|status) and localStorage
  const initialGroupBy = 'status' as GroupBy;
  const [groupBy, setGroupBy] = useState<GroupBy>(initialGroupBy);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [isLoading] = useState(false);
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);

  // Sync reference data from props
  useEffect(() => {
    setVehiclesState(vehicles);
  }, [vehicles]);

  useEffect(() => {
    setClientsState(clients);
  }, [clients]);

  useEffect(() => {
    setClientVehiclesState(clientVehicles);
  }, [clientVehicles]);

  // Initialize driverBreaksState only on mount, don't sync from props after that
  // to avoid overriding real-time updates
  useEffect(() => {
    if (Object.keys(driverBreaks).length > 0) {
      setDriverBreaksState(driverBreaks);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fallback: Poll driver breaks every 30 seconds as backup to realtime
  useEffect(() => {
    if (!supabaseClient) return;
    
    let cancelled = false;
    let pollInterval: NodeJS.Timeout;

    const pollDriverBreaks = async () => {
      if (cancelled) return;

      try {
        const { data, error } = await supabaseClient
          .from('driver_breaks')
          .select('driver_id, ended_at')
          .is('ended_at', null);

        if (!error && data && !cancelled) {
          const activeBreaks: Record<string, boolean> = {};
          data.forEach((breakRecord) => {
            activeBreaks[breakRecord.driver_id] = true;
          });

          setDriverBreaksState((prev) => {
            const hasChanges =
              Object.keys(prev).length !== Object.keys(activeBreaks).length ||
              Object.keys(activeBreaks).some((id) => !prev[id]) ||
              Object.keys(prev).some((id) => prev[id] && !activeBreaks[id]);

            return hasChanges ? activeBreaks : prev;
          });
        }
      } catch (error) {
        console.log('🚀 ~ pollDriverBreaks ~ error:', error);
        // Silent error handling
      }
    };

    // Start polling after 10 seconds (give realtime a chance first)
    const startPolling = setTimeout(() => {
      if (!cancelled) {
        pollDriverBreaks();
        pollInterval = setInterval(pollDriverBreaks, 30000);
      }
    }, 10000);

    return () => {
      cancelled = true;
      clearTimeout(startPolling);
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [supabaseClient]);

  useEffect(() => {
    setAssignees(taskAssignees);
  }, [taskAssignees]);

  // We generally don't sync tasks automatically to avoid overwriting optimistic updates or drag-drop state,
  // unless we are sure about the flow. But typically reference data like vehicles/clients is safe.
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
  const [dialogTask, setDialogTask] = useState<Task | null>(null);
  const [dialogAssignees, setDialogAssignees] = useState<TaskAssignee[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // Filters / search / sorting
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | TaskType>('all');
  const [filterPriority, setFilterPriority] = useState<'all' | TaskPriority>(
    'all'
  );
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>('זמן');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const { range: timeRange } = usePeriod();
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
  const driverMap = useMemo(() => buildDriverMap(drivers), [drivers]);

  const taskAssigneeMap = useMemo(
    () => buildTaskAssigneeMap(assignees),
    [assignees]
  );

  const clientMap = useMemo(() => buildClientMap(clientsState), [clientsState]);

  const vehicleMap = useMemo(
    () => buildVehicleMap(vehiclesState),
    [vehiclesState]
  );

  const clientVehicleMap = useMemo(
    () => buildClientVehicleMap(clientVehiclesState),
    [clientVehiclesState]
  );

  // Compute filtered + sorted tasks snapshot
  const filteredSortedTasks = useMemo(() => {
    const filteredByBasic = filterTasks({
      tasks,
      search,
      filterType,
      filterPriority,
      overdueOnly,
      clientMap,
      vehicleMap,
      clientVehicleMap,
    }).filter((t) => {
      const start = new Date(t.estimated_start).getTime();
      const from = new Date(timeRange.start).getTime();
      const to = new Date(timeRange.end).getTime();
      return start >= from && start <= to;
    });

    return sortTasks({
      tasks: filteredByBasic,
      sortBy,
      sortDir,
      driverMap,
      taskAssigneeMap,
    });
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
    timeRange,
  ]);

  // Compute columns based on groupBy mode
  const columns = useMemo(
    () =>
      computeColumns({
        groupBy,
        assignees,
        driverMap,
        statusLabel,
      }),
    [groupBy, assignees, driverMap]
  );

  // Get tasks for a specific column
  const getColumnTasks = useCallback(
    (columnId: string): Task[] =>
      getColumnTasksUtil({
        columnId,
        groupBy,
        assignees,
        filteredSortedTasks,
      }),
    [filteredSortedTasks, groupBy, assignees]
  );

  const handleVehicleCreated = useCallback((vehicle: Vehicle) => {
    setVehiclesState((prev) => [...prev, vehicle]);
  }, []);

  const handleClientCreated = useCallback((client: Client) => {
    setClientsState((prev) => [...prev, client]);
  }, []);

  const handleClientVehicleCreated = useCallback((vehicle: ClientVehicle) => {
    setClientVehiclesState((prev) => [...prev, vehicle]);
  }, []);

  // Dialog helpers
  const openCreateDialog = useCallback(() => {
    setDialogMode('create');
    setDialogTask(null);
    setDialogAssignees([]);
    setDialogOpen(true);
  }, []);

  const openEditDialog = useCallback(
    (task: Task) => {
      setDialogMode('edit');
      setDialogTask(task);
      setDialogAssignees(taskAssigneeMap.get(task.id) || []);
      setDialogOpen(true);
    },
    [taskAssigneeMap]
  );

  const handleDeleteTask = useCallback(
    async (task: Task) => {
      const taskId = task.id;
      const prevTasks = tasks;
      const prevAssignees = assignees;

      // optimistic remove
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      setAssignees((prev) => prev.filter((ta) => ta.task_id !== taskId));

      try {
        const res = await fetch(`/api/admin/tasks/${taskId}`, {
          method: 'DELETE',
        });
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new Error(text || 'שגיאה במחיקת משימה');
        }
        toastSuccess('המשימה נמחקה בהצלחה');
      } catch {
        setTasks(prevTasks);
        setAssignees(prevAssignees);
        toastError('שגיאה במחיקת משימה');
      }
    },
    [tasks, assignees]
  );

  const handleCreated = useCallback(
    (created: Task, leadId?: string, coIds?: string[]) => {
      // Avoid duplicates if realtime INSERT already added this task
      setTasks((prev) => {
        const exists = prev.some((t) => t.id === created.id);
        if (exists) {
          return prev.map((t) => (t.id === created.id ? created : t));
        }
        return [created, ...prev];
      });

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
      if (inserts.length > 0) {
        setAssignees((prev) => {
          // Remove any placeholder assignees for this task/driver combo to avoid duplicates
          const filtered = prev.filter(
            (ta) =>
              !inserts.some(
                (ins) =>
                  ins.task_id === ta.task_id &&
                  ins.driver_id === ta.driver_id &&
                  ins.is_lead === ta.is_lead
              )
          );
          return [...filtered, ...inserts];
        });
      }

      // Toast is shown in TaskDialog, no need to show it here
      try {
        trackTaskCreated(created, leadId);
      } catch {}
    },
    []
  );

  // DnD: finalize drop and persist changes

  // Track tasks that are being updated via handleUpdated to prevent realtime from overwriting
  const updatingTasksRef = React.useRef<Set<string>>(new Set());

  const handleUpdated = useCallback(
    (updated: Task, leadId?: string, coIds?: string[]) => {
      console.log('[TasksBoard] handleUpdated called:', {
        taskId: updated.id,
        advisor_color: updated.advisor_color,
        advisor_name: updated.advisor_name,
        fullTask: updated,
      });

      // Mark this task as being updated manually
      updatingTasksRef.current.add(updated.id);

      setTasks((prev) => {
        return prev.map((t) => {
          if (t.id === updated.id) {
            // Replace the entire task with the updated version from the API
            // This ensures all fields including advisor_color are properly updated
            // Use the updated task directly from API, which has the latest data
            const merged: Task = {
              ...updated, // Start with the fresh data from API
              // Preserve stops if they weren't included in the update response
              stops: updated.stops !== undefined ? updated.stops : t.stops,
            };
            console.log('[TasksBoard] Merged task:', {
              taskId: merged.id,
              advisor_color: merged.advisor_color,
              advisor_name: merged.advisor_name,
              updated_advisor_color: updated.advisor_color,
              updated_advisor_name: updated.advisor_name,
              hasStops: !!merged.stops,
            });

            // Clear the flag after a short delay to allow realtime updates again
            setTimeout(() => {
              updatingTasksRef.current.delete(updated.id);
            }, 1000);

            return merged;
          }
          return t;
        });
      });

      // If driver info was provided, sync local assignees snapshot for this task
      if (leadId !== undefined || coIds !== undefined) {
        setAssignees((prev) => {
          // Remove all existing assignees for this task
          const without = prev.filter((ta) => ta.task_id !== updated.id);
          const inserts: TaskAssignee[] = [];

          if (leadId) {
            inserts.push({
              id: `local-${updated.id}-lead`,
              task_id: updated.id,
              driver_id: leadId,
              is_lead: true,
              assigned_at: new Date().toISOString(),
            });
          }

          (coIds || []).forEach((id) => {
            inserts.push({
              id: `local-${updated.id}-${id}`,
              task_id: updated.id,
              driver_id: id,
              is_lead: false,
              assigned_at: new Date().toISOString(),
            });
          });

          return [...without, ...inserts];
        });
      }
    },
    []
  );

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

  // Persist driver unassignment (remove all assignments)
  const persistDriverUnassignment = useCallback(
    async (taskId: string, prevSnapshot?: TaskAssignee[]) => {
      try {
        const response = await fetch(`/api/admin/tasks/${taskId}/unassign`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          console.error('Failed to unassign driver:', response.statusText);
          if (prevSnapshot) {
            setAssignees(prevSnapshot);
          }
          toastError('שגיאה בהסרת הקצאת נהג');
        } else {
          toastSuccess('הנהג הוסר מהמשימה');
        }
      } catch (error) {
        console.error('Error persisting driver unassignment:', error);
        if (prevSnapshot) {
          setAssignees(prevSnapshot);
        }
        toastError('שגיאה בהסרת הקצאת נהג');
      }
    },
    []
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

        // Handle unassigning
        if (targetDriverId === 'unassigned') {
          if (!currentAssignee) return; // Already unassigned
          const prevSnapshot = assignees;
          // Remove all assignments for this task
          setAssignees((prevAssignees) =>
            prevAssignees.filter((ta) => ta.task_id !== taskId)
          );
          persistDriverUnassignment(taskId, prevSnapshot);
          return;
        }

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
    [
      tasks,
      assignees,
      groupBy,
      persistDriverAssignment,
      persistDriverUnassignment,
      persistTaskUpdate,
    ]
  );

  // Realtime updates (tasks, task_assignees, driver_breaks)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!supabaseClient) {
      console.log('[TasksBoard] Waiting for Supabase client...');
      return;
    }
    
    let channel: ReturnType<typeof supabaseClient.channel> | null = null;
    let isMounted = true;
    
    // We need to ensure the Supabase session is loaded before setting up Realtime
    // This is async because the session is restored from localStorage
    const setupRealtime = async () => {
      try {
        // Check if we have a valid Supabase session (JWT)
        const { data: { session } } = await supabaseClient.auth.getSession();
        
        if (!session) {
          console.warn('[TasksBoard] No Supabase session found - Realtime RLS may fail');
          console.log('[TasksBoard] Attempting to refresh session...');
          
          // Try to refresh the session
          const { data: refreshData } = await supabaseClient.auth.refreshSession();
          if (!refreshData.session) {
            console.error('[TasksBoard] ❌ No valid session for Realtime - updates will not work');
            return;
          }
          console.log('[TasksBoard] ✅ Session refreshed successfully');
        } else {
          console.log('[TasksBoard] ✅ Valid Supabase session found, user:', session.user?.id);
        }
        
        if (!isMounted) return;
        
        console.log('[TasksBoard] Setting up real-time subscription...');
        channel = supabaseClient
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
                  console.log('[TasksBoard] UPDATE event received:', {
                    taskId: row.id,
                    status: row.status,
                    fullRow: row,
                  });

                  // Skip realtime update if this task is being manually updated by admin
                  if (updatingTasksRef.current.has(row.id)) {
                    return prev;
                  }

                  return prev.map((t) => {
                    if (t.id === row.id) {
                      // Merge the entire row from Supabase to ensure all fields (including status and dates) are up to date
                      // We use spread to ensure we don't lose any fields that exist in the local state but not in the payload
                      const updatedTask = { 
                        ...t, 
                        ...row,
                        // Ensure we use the status from the DB as it defines the column
                        status: row.status || t.status
                      };
                      
                      return updatedTask;
                    }
                    return t;
                  });
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
                  // Deduplicate: check if we already have this record (by ID or by task+driver combo)
                  const existingIndex = prev.findIndex(
                    (a) =>
                      a.id === row.id ||
                      (a.task_id === row.task_id &&
                        a.driver_id === row.driver_id &&
                        a.is_lead === row.is_lead)
                  );

                  if (existingIndex !== -1) {
                    // If it's a local placeholder, replace it with the real data
                    if (prev[existingIndex].id.startsWith('local-')) {
                      const next = [...prev];
                      next[existingIndex] = row;
                      return next;
                    }
                    return prev;
                  }
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
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'driver_breaks',
            },
            (payload: PostgresChangePayload) => {
              console.log(
                '[TasksBoard] driver_breaks event received:',
                payload
              );
              setDriverBreaksState((prev) => {
                const newState = { ...prev };
                if (payload.eventType === 'INSERT') {
                  const row = payload.new as {
                    driver_id: string;
                    ended_at: string | null;
                  };
                  console.log(
                    '[TasksBoard] Driver started break:',
                    row.driver_id
                  );
                  if (!row.ended_at) {
                    newState[row.driver_id] = true;
                  }
                }
                if (payload.eventType === 'UPDATE') {
                  const row = payload.new as {
                    driver_id: string;
                    ended_at: string | null;
                  };
                  console.log(
                    '[TasksBoard] Driver break updated:',
                    row.driver_id,
                    'ended_at:',
                    row.ended_at
                  );
                  if (row.ended_at) {
                    delete newState[row.driver_id];
                  } else {
                    newState[row.driver_id] = true;
                  }
                }
                if (payload.eventType === 'DELETE') {
                  const row = payload.old as { driver_id: string };
                  console.log(
                    '[TasksBoard] Driver break deleted:',
                    row.driver_id
                  );
                  if (row.driver_id) {
                    delete newState[row.driver_id];
                  }
                }
                return newState;
              });
            }
          )
          .subscribe((status) => {
            console.log('[TasksBoard] Realtime subscription status:', status);
            if (status === 'SUBSCRIBED') {
              console.log('[TasksBoard] ✅ Successfully subscribed to realtime updates');
            }
            if (status === 'CHANNEL_ERROR') {
              console.error('[TasksBoard] ❌ Channel error - check Supabase realtime config');
            }
            // Note: Don't auto-reconnect on TIMED_OUT or CLOSED here
            // The AuthProvider handles token refresh via client.realtime.setAuth()
            // which keeps the connection alive. Manual reconnects can cause loops.
          });
      } catch (error) {
        console.error('[TasksBoard] Error setting up realtime:', error);
      }
    };
    
    setupRealtime();
    
    // Cleanup
    return () => {
      isMounted = false;
      try {
        if (channel && supabaseClient) {
          supabaseClient.removeChannel(channel);
        }
      } catch (error) {
        console.error('[TasksBoard] Error cleaning up channel:', error);
      }
    };
  }, [supabaseClient]);

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
              className={`px-4 py-2 text-sm font-medium rounded transition-colors 
                flex items-center gap-2
                ${
                  groupBy === 'status'
                    ? 'bg-white text-primary shadow-sm'
                    : 'text-gray-700 hover:text-gray-900'
                }`}
              aria-pressed={groupBy === 'status'}
            >
              <ListIcon className="w-4 h-4" />
              סטטוס
            </button>
            <button
              onClick={() => persistGroupBy('driver')}
              className={`px-4 py-2 text-sm font-medium rounded transition-colors flex items-center gap-2 ${
                groupBy === 'driver'
                  ? 'bg-white text-primary shadow-sm'
                  : 'text-gray-700 hover:text-gray-900'
              }`}
              aria-pressed={groupBy === 'driver'}
            >
              <UsersIcon className="w-4 h-4" />
              נהג
            </button>
          </div>

          <button
            onClick={openCreateDialog}
            className="rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90 flex items-center gap-2"
          >
            <PlusIcon className="w-4 h-4" />
            משימה חדשה
          </button>
        </div>

        {/* Kanban board container */}
        <div
          className="h-[calc(100vh-200px)] min-h-0 flex flex-col rounded-lg border border-gray-200 bg-white shadow-sm"
          role="main"
          aria-label="לוח משימות"
        >
          {/* Filters & Search & Sort */}
          <div className="relative z-50 flex flex-wrap items-center gap-3 border-b border-gray-100 px-4 py-2 bg-white shrink-0">
            <input
              type="text"
              placeholder="חפש משימות (כותרת / לקוח / רכב סוכנות)"
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
                { value: 'איסוף רכב/שינוע', label: 'איסוף רכב/שינוע' },
                { value: 'החזרת רכב/שינוע', label: 'החזרת רכב/שינוע' },
                { value: 'מסירת רכב חלופי', label: 'מסירת רכב חלופי' },
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
            {(() => {
              const priorityOptions: Array<{
                value: 'all' | TaskPriority;
                label: string;
              }> = [
                { value: 'all', label: 'כל העדיפויות' },
                { value: 'ללא עדיפות', label: 'ללא עדיפות' },
                { value: 'מיידי', label: 'מיידי' },
              ];
              const currentLabel =
                priorityOptions.find((o) => o.value === filterPriority)
                  ?.label || 'כל העדיפויות';
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
                    className="w-44 bg-white text-right *:text-right"
                    style={{ direction: 'rtl' }}
                  >
                    <DropdownMenuRadioGroup
                      value={filterPriority}
                      onValueChange={(value) =>
                        setFilterPriority(value as 'all' | TaskPriority)
                      }
                    >
                      {priorityOptions.map(({ value, label }) => (
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
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={overdueOnly}
                onChange={(e) => setOverdueOnly(e.target.checked)}
              />
              באיחור בלבד
            </label>
            <div className="ml-auto flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="text-sm font-normal justify-start"
                  >
                    <ArrowUpDownIcon className="w-4 h-4" />
                    <span className="text-sm font-normal text-gray-700 mr-2">
                      סדר על פי
                    </span>
                    <span className="text-sm font-normal text-blue-700">
                      {sortBy}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="z-1000 w-44 bg-white text-right *:text-right"
                  style={{ direction: 'rtl' }}
                  sideOffset={8}
                >
                  <DropdownMenuRadioGroup
                    value={sortBy}
                    onValueChange={(value) => setSortBy(value as SortBy)}
                  >
                    <DropdownMenuRadioItem value="זמן">
                      זמן
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="עדיפות">
                      עדיפות
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="נהג">
                      נהג
                    </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>

              {sortBy === 'זמן' && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className="text-sm font-normal justify-start"
                    >
                      <ArrowUpDownIcon className="w-4 h-4" />
                      <span className="text-sm font-normal text-gray-700 mr-2">
                        סדר
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    className="z-1000 w-44 bg-white text-right *:text-right"
                    style={{ direction: 'rtl' }}
                    sideOffset={8}
                  >
                    <DropdownMenuRadioGroup
                      value={sortDir}
                      onValueChange={(value) => setSortDir(value as SortDir)}
                    >
                      <DropdownMenuRadioItem value="asc">
                        מהקודם לאחרון
                      </DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="desc">
                        מהאחרון לקודם
                      </DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
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
                <div className="flex items-center gap-3 border-b border-gray-200 bg-gray-50 px-4 py-2 shrink-0">
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
              <div
                className="flex flex-1 min-h-0 gap-6 overflow-x-auto overflow-y-hidden p-4"
                style={{
                  scrollbarWidth: 'thin',
                  scrollbarColor: '#9ca3af #f3f4f6',
                }}
              >
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
                      clientVehicleMap={clientVehicleMap}
                      conflict={conflictByTaskId}
                      onDragStart={handleDragStart}
                      toggleSelected={toggleSelected}
                      onEdit={openEditDialog}
                      onDelete={handleDeleteTask}
                      selectAllInColumn={selectAllInColumn}
                      bulkEnabled={!!bulkEnabled}
                      driverBreaks={driverBreaksState}
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
          <div className="rounded-lg border-2 border-primary bg-white p-3 shadow-xl opacity-95 w-80">
            <div className="mb-2 flex items-start justify-between gap-2">
              {/* <h4 className="flex-1 line-clamp-2 font-semibold text-gray-900 text-sm">
                {typeLabel(draggedTask.type)}
              </h4> */}
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
            clients={clientsState}
            vehicles={vehiclesState}
            clientVehicles={clientVehiclesState}
            assignees={dialogAssignees}
            onCreated={handleCreated}
            onUpdated={handleUpdated}
            onVehicleCreated={handleVehicleCreated}
            onClientCreated={handleClientCreated}
            onClientVehicleCreated={handleClientVehicleCreated}
          />
        </Suspense>
      )}
    </DndContext>
  );
}
