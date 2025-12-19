'use client';

import { useState, useMemo, useCallback, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  addWeeks,
  addMonths,
  subWeeks,
  subMonths,
  isSameDay,
  parseISO,
  differenceInMilliseconds,
  addDays,
} from 'date-fns';
import { he } from 'date-fns/locale';
import type {
  Task,
  TaskAssignee,
  CalendarView,
  CalendarFilters,
} from '@/types/task';
import type { Driver } from '@/types/user';
import type { Client, Vehicle } from '@/types/entity';
import { CalendarHeader } from './CalendarHeader';
import { CalendarFiltersPanel } from './CalendarFilters';
import { WeekView } from './WeekView';
import { MonthView } from './MonthView';
import { CalendarTaskOverlay } from './CalendarTask';
import { toastSuccess, toastError } from '@/lib/toast';

// Lazy load TaskDialog
const LazyTaskDialog = dynamic(
  () => import('../TaskDialog').then((mod) => ({ default: mod.TaskDialog })),
  { ssr: false }
);

interface CalendarShellProps {
  initialTasks: Task[];
  drivers: Driver[];
  taskAssignees: TaskAssignee[];
  clients: Client[];
  vehicles: Vehicle[];
}

export function CalendarShell({
  initialTasks,
  drivers,
  taskAssignees,
  clients,
  vehicles,
}: CalendarShellProps) {
  const router = useRouter();

  // State
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [clientsState, setClientsState] = useState<Client[]>(clients);
  const [vehiclesState, setVehiclesState] = useState<Vehicle[]>(vehicles);
  const [view, setView] = useState<CalendarView>('week');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [filters, setFilters] = useState<CalendarFilters>({
    taskTypes: [],
    statuses: [],
    priorities: [],
    driverIds: [],
    clientIds: [],
  });
  const [showFilters, setShowFilters] = useState(false);
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
  const [dialogTask, setDialogTask] = useState<Task | null>(null);
  const [dialogAssignees, setDialogAssignees] = useState<TaskAssignee[]>([]);
  const [prefilledDate, setPrefilledDate] = useState<Date | null>(null);

  // DnD sensors
  const mouseSensor = useSensor(MouseSensor, {
    activationConstraint: { distance: 10 },
  });
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: { delay: 250, tolerance: 5 },
  });
  const sensors = useSensors(mouseSensor, touchSensor);

  // Calculate date range based on view
  const dateRange = useMemo(() => {
    if (view === 'week') {
      return {
        start: startOfWeek(currentDate, { locale: he, weekStartsOn: 0 }),
        end: endOfWeek(currentDate, { locale: he, weekStartsOn: 0 }),
      };
    } else {
      return {
        start: startOfMonth(currentDate),
        end: endOfMonth(currentDate),
      };
    }
  }, [view, currentDate]);

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      // Filter by task type
      if (
        filters.taskTypes.length > 0 &&
        !filters.taskTypes.includes(task.type)
      ) {
        return false;
      }

      // Filter by status
      if (
        filters.statuses.length > 0 &&
        !filters.statuses.includes(task.status)
      ) {
        return false;
      }

      // Filter by priority
      if (
        filters.priorities.length > 0 &&
        !filters.priorities.includes(task.priority)
      ) {
        return false;
      }

      // Filter by driver
      if (filters.driverIds.length > 0) {
        const taskDriverIds = taskAssignees
          .filter((a) => a.task_id === task.id)
          .map((a) => a.driver_id);
        if (!taskDriverIds.some((id) => filters.driverIds.includes(id))) {
          return false;
        }
      }

      // Filter by client
      if (filters.clientIds.length > 0) {
        if (!task.client_id || !filters.clientIds.includes(task.client_id)) {
          return false;
        }
      }

      return true;
    });
  }, [tasks, filters, taskAssignees]);

  // Active filters count
  const activeFiltersCount = useMemo(() => {
    return (
      filters.taskTypes.length +
      filters.statuses.length +
      filters.priorities.length +
      filters.driverIds.length +
      filters.clientIds.length
    );
  }, [filters]);

  // Navigation handlers
  const handlePrevious = useCallback(() => {
    if (view === 'week') {
      setCurrentDate((d) => subWeeks(d, 1));
    } else {
      setCurrentDate((d) => subMonths(d, 1));
    }
  }, [view]);

  const handleNext = useCallback(() => {
    if (view === 'week') {
      setCurrentDate((d) => addWeeks(d, 1));
    } else {
      setCurrentDate((d) => addMonths(d, 1));
    }
  }, [view]);

  const handleToday = useCallback(() => {
    const today = new Date();
    // Force update even if already on today by creating a new Date object
    setCurrentDate(new Date(today.getTime()));
  }, []);

  const handleViewChange = useCallback((newView: CalendarView) => {
    setView(newView);
  }, []);

  // Task dialog handlers
  const handleCreateTask = useCallback((date?: Date) => {
    setDialogMode('create');
    setDialogTask(null);
    setDialogAssignees([]);
    setPrefilledDate(date || null);
    setDialogOpen(true);
  }, []);

  const handleEditTask = useCallback(
    (task: Task) => {
      setDialogMode('edit');
      setDialogTask(task);
      setDialogAssignees(taskAssignees.filter((a) => a.task_id === task.id));
      setPrefilledDate(null);
      setDialogOpen(true);
    },
    [taskAssignees]
  );

  const handleTaskCreated = useCallback(
    (newTask: Task, leadDriverId?: string, coDriverIds?: string[]) => {
      setTasks((prev) => [...prev, newTask]);
      setDialogOpen(false);
      setPrefilledDate(null);
      toastSuccess('המשימה נוצרה בהצלחה');
      // Refresh the page to get updated data from server
      router.refresh();
    },
    [router]
  );

  const handleTaskUpdated = useCallback(
    (updatedTask: Task, leadDriverId?: string, coDriverIds?: string[]) => {
      setTasks((prev) =>
        prev.map((t) => (t.id === updatedTask.id ? updatedTask : t))
      );
      setDialogOpen(false);
      setPrefilledDate(null);
      toastSuccess('המשימה עודכנה בהצלחה');
      // Refresh the page to get updated data from server
      router.refresh();
    },
    [router]
  );

  const handleDialogOpenChange = useCallback((open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      // Reset prefilled date when dialog closes
      setPrefilledDate(null);
    }
  }, []);

  const handleClientCreated = useCallback((client: Client) => {
    setClientsState((prev) => [...prev, client]);
  }, []);

  const handleVehicleCreated = useCallback((vehicle: Vehicle) => {
    setVehiclesState((prev) => [...prev, vehicle]);
  }, []);

  // Drag and drop handlers
  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const taskId = event.active.id as string;
      const task = tasks.find((t) => t.id === taskId);
      if (task) {
        setDraggedTask(task);
      }
    },
    [tasks]
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      setDraggedTask(null);

      if (!over) return;

      const taskId = active.id as string;
      const targetDateStr = over.id as string;

      // Parse target date
      const targetDate = parseISO(targetDateStr);
      if (isNaN(targetDate.getTime())) return;

      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;

      // Check if dropped on same day
      const taskStartDate = parseISO(task.estimated_start);
      if (isSameDay(taskStartDate, targetDate)) return;

      // Calculate duration
      const taskEndDate = parseISO(task.estimated_end);
      const duration = differenceInMilliseconds(taskEndDate, taskStartDate);

      // Calculate new dates (preserve time)
      const newStartDate = new Date(targetDate);
      newStartDate.setHours(
        taskStartDate.getHours(),
        taskStartDate.getMinutes(),
        taskStartDate.getSeconds()
      );
      const newEndDate = new Date(newStartDate.getTime() + duration);

      // Optimistic update
      const updatedTask = {
        ...task,
        estimated_start: newStartDate.toISOString(),
        estimated_end: newEndDate.toISOString(),
      };

      setTasks((prev) => prev.map((t) => (t.id === taskId ? updatedTask : t)));

      // Update in database
      try {
        const response = await fetch(`/api/admin/tasks/${taskId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            estimated_start: newStartDate.toISOString(),
            estimated_end: newEndDate.toISOString(),
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to update task');
        }

        toastSuccess('תאריך המשימה עודכן');
        router.refresh();
      } catch {
        // Revert on error
        setTasks((prev) => prev.map((t) => (t.id === taskId ? task : t)));
        toastError('שגיאה בעדכון תאריך המשימה');
      }
    },
    [tasks, router]
  );

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col gap-4">
        {/* Header with view toggle and navigation */}
        <CalendarHeader
          view={view}
          currentDate={currentDate}
          dateRange={dateRange}
          onViewChange={handleViewChange}
          onPrevious={handlePrevious}
          onNext={handleNext}
          onToday={handleToday}
          onCreateTask={() => handleCreateTask()}
          onToggleFilters={() => setShowFilters((v) => !v)}
          activeFiltersCount={activeFiltersCount}
          showFilters={showFilters}
        />

        {/* Filters panel */}
        {showFilters && (
          <CalendarFiltersPanel
            filters={filters}
            onFiltersChange={setFilters}
            drivers={drivers}
            clients={clientsState}
          />
        )}

        {/* Task type legend */}
        <div className="flex flex-wrap items-center gap-3 px-2">
          <span className="text-xs font-medium text-slate-500">
            מקרא צבעים:
          </span>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1 text-xs">
              <span className="w-3 h-3 rounded bg-blue-500"></span>
              איסוף רכב
            </span>
            <span className="inline-flex items-center gap-1 text-xs">
              <span className="w-3 h-3 rounded bg-green-500"></span>
              החזרת רכב
            </span>
            <span className="inline-flex items-center gap-1 text-xs">
              <span className="w-3 h-3 rounded bg-purple-500"></span>
              רכב חלופי
            </span>
            <span className="inline-flex items-center gap-1 text-xs">
              <span className="w-3 h-3 rounded bg-teal-500"></span>
              לקוח הביתה
            </span>
            <span className="inline-flex items-center gap-1 text-xs">
              <span className="w-3 h-3 rounded bg-orange-500"></span>
              לקוח למוסך
            </span>
            <span className="inline-flex items-center gap-1 text-xs">
              <span className="w-3 h-3 rounded bg-yellow-500"></span>
              טסט
            </span>
            <span className="inline-flex items-center gap-1 text-xs">
              <span className="w-3 h-3 rounded bg-red-500"></span>
              חילוץ
            </span>
            <span className="inline-flex items-center gap-1 text-xs">
              <span className="w-3 h-3 rounded bg-slate-500"></span>
              אחר
            </span>
          </div>
        </div>

        {/* Calendar view */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-x-auto custom-scrollbar">
          {view === 'week' ? (
            <WeekView
              tasks={filteredTasks}
              taskAssignees={taskAssignees}
              drivers={drivers}
              clients={clientsState}
              currentDate={currentDate}
              dateRange={dateRange}
              onTaskClick={handleEditTask}
              onDayClick={handleCreateTask}
            />
          ) : (
            <MonthView
              tasks={filteredTasks}
              taskAssignees={taskAssignees}
              drivers={drivers}
              clients={clientsState}
              currentDate={currentDate}
              dateRange={dateRange}
              onTaskClick={handleEditTask}
              onDayClick={handleCreateTask}
            />
          )}
        </div>
      </div>

      {/* Drag overlay */}
      <DragOverlay>
        {draggedTask && <CalendarTaskOverlay task={draggedTask} />}
      </DragOverlay>

      {/* Task dialog */}
      {dialogOpen && (
        <Suspense fallback={null}>
          <LazyTaskDialog
            open={dialogOpen}
            onOpenChange={handleDialogOpenChange}
            mode={dialogMode}
            task={dialogTask}
            drivers={drivers}
            clients={clientsState}
            vehicles={vehiclesState}
            assignees={dialogAssignees}
            prefilledDate={prefilledDate}
            onCreated={handleTaskCreated}
            onUpdated={handleTaskUpdated}
            onClientCreated={handleClientCreated}
            onVehicleCreated={handleVehicleCreated}
          />
        </Suspense>
      )}
    </DndContext>
  );
}
