'use client';

import { useMemo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import {
  format,
  eachDayOfInterval,
  isSameDay,
  isToday,
  parseISO,
  startOfDay,
  getDay,
} from 'date-fns';
import { he } from 'date-fns/locale';
import { Plus } from 'lucide-react';
import type { Task, TaskAssignee } from '@/types/task';
import type { Driver } from '@/types/user';
import type { Client } from '@/types/entity';
import { CalendarTask } from './CalendarTask';
import { cn } from '@/lib/utils';
import dayjs from '@/lib/dayjs';

interface WeekViewProps {
  tasks: Task[];
  taskAssignees: TaskAssignee[];
  drivers: Driver[];
  clients: Client[];
  currentDate: Date;
  dateRange: { start: Date; end: Date };
  onTaskClick: (task: Task) => void;
  onDayClick: (date: Date) => void;
}

function DayColumn({
  date,
  tasks,
  taskAssignees,
  drivers,
  clients,
  onTaskClick,
  onDayClick,
}: {
  date: Date;
  tasks: Task[];
  taskAssignees: TaskAssignee[];
  drivers: Driver[];
  clients: Client[];
  onTaskClick: (task: Task) => void;
  onDayClick: (date: Date) => void;
}) {
  const dateStr = format(date, 'yyyy-MM-dd');
  const { setNodeRef, isOver } = useDroppable({ id: dateStr });

  // Get tasks for this day
  const dayTasks = useMemo(() => {
    // Normalize the calendar date to Israel timezone for comparison
    const dayDateStr = dayjs(date).tz('Asia/Jerusalem').format('YYYY-MM-DD');
    
    return tasks
      .filter((task) => {
        // Parse task date and normalize to Israel timezone for consistent comparison
        const taskIsraelDate = dayjs(task.estimated_start).tz('Asia/Jerusalem').format('YYYY-MM-DD');
        return taskIsraelDate === dayDateStr;
      })
      .sort((a, b) => {
        const aTime = parseISO(a.estimated_start).getTime();
        const bTime = parseISO(b.estimated_start).getTime();
        return aTime - bTime;
      });
  }, [tasks, date]);

  // Get driver and client info for each task
  const getTaskDrivers = (taskId: string) => {
    const assigneeIds = taskAssignees
      .filter((a) => a.task_id === taskId)
      .map((a) => a.driver_id);
    return drivers.filter((d) => assigneeIds.includes(d.id));
  };

  const getTaskClient = (clientId: string | null) => {
    if (!clientId) return null;
    return clients.find((c) => c.id === clientId) || null;
  };

  const today = isToday(date);
  const dayName = format(date, 'EEE', { locale: he });
  const dayNum = format(date, 'd');
  const monthName = format(date, 'MMM', { locale: he });
  const isSaturday = getDay(date) === 6;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex flex-col border-r border-slate-200 last:border-r-0 min-h-[600px]',
        isOver && 'bg-toyota-red/5',
        isSaturday && 'bg-amber-50/30'
      )}
    >
      {/* Day header - Google Calendar style */}
      <div
        className={cn(
          'sticky top-0 z-10 border-b border-slate-200 bg-white p-3 text-center',
          today && 'bg-blue-50'
        )}
      >
        <div
          className={cn(
            'text-xs font-semibold uppercase tracking-wider mb-1',
            today ? 'text-blue-600' : isSaturday ? 'text-amber-600' : 'text-slate-500'
          )}
        >
          {dayName}
        </div>
        <div
          className={cn(
            'inline-flex h-10 w-10 items-center justify-center rounded-full text-xl font-bold transition-colors',
            today
              ? 'bg-toyota-red text-white shadow-md'
              : 'text-slate-900 hover:bg-slate-100'
          )}
        >
          {dayNum}
        </div>
        {today && (
          <div className="text-xs text-blue-600 font-medium mt-1">
            {monthName}
          </div>
        )}
      </div>

      {/* Tasks container */}
      <div
        className="flex-1 p-2 space-y-2 overflow-y-auto cursor-pointer"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onDayClick(date);
          }
        }}
      >
        {dayTasks.map((task) => (
          <CalendarTask
            key={task.id}
            task={task}
            assignedDrivers={getTaskDrivers(task.id)}
            client={getTaskClient(task.client_id)}
            onClick={() => onTaskClick(task)}
          />
        ))}

        {/* Add task placeholder when empty */}
        {dayTasks.length === 0 && (
          <button
            onClick={() => onDayClick(date)}
            className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-200 p-4 sm:p-6 text-sm text-slate-400 transition-all hover:border-toyota-red hover:text-toyota-red hover:bg-toyota-red/5 group"
          >
            <Plus className="h-5 w-5 group-hover:scale-110 transition-transform" />
            <span>הוסף משימה</span>
          </button>
        )}
      </div>

      {/* Task count footer */}
      {dayTasks.length > 0 && (
        <div className="border-t border-slate-100 p-2 text-center bg-slate-50/50">
          <span className="text-xs font-medium text-slate-500">
            {dayTasks.length} משימות
          </span>
        </div>
      )}
    </div>
  );
}

export function WeekView({
  tasks,
  taskAssignees,
  drivers,
  clients,
  currentDate,
  dateRange,
  onTaskClick,
  onDayClick,
}: WeekViewProps) {
  // Get all days in the week
  const days = useMemo(() => {
    return eachDayOfInterval({
      start: dateRange.start,
      end: dateRange.end,
    });
  }, [dateRange]);

  return (
    <div dir="ltr" className="grid grid-cols-7 divide-x divide-slate-200 bg-white min-w-[700px] md:min-w-0">
      {days.map((day) => (
        <DayColumn
          key={format(day, 'yyyy-MM-dd')}
          date={day}
          tasks={tasks}
          taskAssignees={taskAssignees}
          drivers={drivers}
          clients={clients}
          onTaskClick={onTaskClick}
          onDayClick={onDayClick}
        />
      ))}
    </div>
  );
}
