'use client';

import { useMemo, useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import {
  format,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfDay,
  startOfWeek,
  endOfWeek,
  getDay,
} from 'date-fns';
import { he } from 'date-fns/locale';
import { MoreHorizontal } from 'lucide-react';
import type { Task, TaskAssignee } from '@/types/task';
import type { Driver } from '@/types/user';
import type { Client } from '@/types/entity';
import { CalendarTask } from './CalendarTask';
import { cn } from '@/lib/utils';
import dayjs from '@/lib/dayjs';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

const MAX_VISIBLE_TASKS = 3;

interface MonthViewProps {
  tasks: Task[];
  taskAssignees: TaskAssignee[];
  drivers: Driver[];
  clients: Client[];
  currentDate: Date;
  dateRange: { start: Date; end: Date };
  onTaskClick: (task: Task) => void;
  onDayClick: (date: Date) => void;
}

function DayCell({
  date,
  isCurrentMonth,
  tasks,
  taskAssignees,
  drivers,
  clients,
  onTaskClick,
  onDayClick,
}: {
  date: Date;
  isCurrentMonth: boolean;
  tasks: Task[];
  taskAssignees: TaskAssignee[];
  drivers: Driver[];
  clients: Client[];
  onTaskClick: (task: Task) => void;
  onDayClick: (date: Date) => void;
}) {
  const dateStr = format(date, 'yyyy-MM-dd');
  const { setNodeRef, isOver } = useDroppable({ id: dateStr });
  const [showMore, setShowMore] = useState(false);

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

  const visibleTasks = dayTasks.slice(0, MAX_VISIBLE_TASKS);
  const hiddenTasks = dayTasks.slice(MAX_VISIBLE_TASKS);
  const hasMore = hiddenTasks.length > 0;

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
  const dayNum = format(date, 'd');
  const isSaturday = getDay(date) === 6;

  return (
    <div
      ref={setNodeRef}
      onClick={() => onDayClick(date)}
      className={cn(
        'group min-h-[130px] border-b border-r border-slate-200 p-1.5 cursor-pointer transition-colors hover:bg-slate-50/50',
        !isCurrentMonth && 'bg-slate-50/80',
        isOver && 'bg-toyota-red/5 ring-2 ring-inset ring-toyota-red/20',
        today && 'bg-blue-50/30',
        isSaturday && 'bg-amber-50/30'
      )}
    >
      {/* Day number and task count badge */}
      <div className="flex items-center justify-between mb-1.5">
        {/* Task count badge */}
        {dayTasks.length > 0 && isCurrentMonth && (
          <div className="flex items-center gap-1">
            <span
              className={cn(
                'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold',
                dayTasks.length >= 5
                  ? 'bg-red-500 text-white'
                  : dayTasks.length >= 3
                  ? 'bg-orange-500 text-white'
                  : 'bg-blue-500 text-white'
              )}
            >
              {dayTasks.length}
            </span>
            <span className="text-[9px] text-slate-400 font-medium">
              מס׳ משימות
            </span>
          </div>
        )}
        {(dayTasks.length === 0 || !isCurrentMonth) && <span />}

        {/* Day number */}
        <span
          className={cn(
            'inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold transition-colors',
            today
              ? 'bg-toyota-red text-white shadow-sm'
              : isCurrentMonth
              ? 'text-slate-700 group-hover:bg-slate-100'
              : 'text-slate-400'
          )}
        >
          {dayNum}
        </span>
      </div>

      {/* Tasks */}
      <div className="space-y-1">
        {visibleTasks.map((task) => (
          <CalendarTask
            key={task.id}
            task={task}
            assignedDrivers={getTaskDrivers(task.id)}
            client={getTaskClient(task.client_id)}
            compact
            onClick={() => onTaskClick(task)}
          />
        ))}

        {/* More tasks popover */}
        {hasMore && (
          <Popover open={showMore} onOpenChange={setShowMore}>
            <PopoverTrigger asChild>
              <button
                onClick={(e) => e.stopPropagation()}
                className="w-full text-xs font-medium text-blue-600 hover:text-blue-700 py-1 flex items-center justify-center gap-1 rounded-md hover:bg-blue-50 transition-colors"
              >
                <MoreHorizontal className="h-3 w-3" />
                עוד {hiddenTasks.length}
              </button>
            </PopoverTrigger>
            <PopoverContent
              className="w-80 p-0 max-h-96 overflow-hidden shadow-2xl border border-slate-200 bg-white z-50"
              align="center"
              side="bottom"
              dir="rtl"
            >
              <div className="bg-slate-100 px-4 py-3 border-b border-slate-200">
                <div className="text-sm font-bold text-slate-800">
                  {format(date, 'EEEE, d בMMMM', { locale: he })}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {dayTasks.length} משימות
                </div>
              </div>
              <div className="p-3 space-y-2 overflow-y-auto max-h-72 bg-white">
                {dayTasks.map((task) => (
                  <CalendarTask
                    key={task.id}
                    task={task}
                    assignedDrivers={getTaskDrivers(task.id)}
                    client={getTaskClient(task.client_id)}
                    compact
                    onClick={() => {
                      setShowMore(false);
                      onTaskClick(task);
                    }}
                  />
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );
}

export function MonthView({
  tasks,
  taskAssignees,
  drivers,
  clients,
  currentDate,
  dateRange,
  onTaskClick,
  onDayClick,
}: MonthViewProps) {
  // Get all days to display (including padding from previous/next months)
  const days = useMemo(() => {
    const monthStart = dateRange.start;
    const monthEnd = dateRange.end;
    // Start from Sunday (weekStartsOn: 0)
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

    return eachDayOfInterval({
      start: calendarStart,
      end: calendarEnd,
    });
  }, [dateRange]);

  // Day names header - Sunday to Saturday (LTR order for proper grid display)
  const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const dayNamesHebrew = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];

  // Group days into weeks for proper rendering
  const weeks = useMemo(() => {
    const result: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      result.push(days.slice(i, i + 7));
    }
    return result;
  }, [days]);

  return (
    <div dir="ltr" className="w-full min-w-[800px] md:min-w-0">
      {/* Day names header - Google Calendar style */}
      <div className="grid grid-cols-7 border-b border-slate-200 bg-white sticky top-0 z-10">
        {dayNames.map((name, index) => (
          <div
            key={name}
            className={cn(
              'py-3 text-center text-xs font-semibold uppercase tracking-wider border-r border-slate-100 last:border-r-0',
              index === 6 ? 'text-amber-600' : 'text-slate-500'
            )}
          >
            <span className="hidden sm:inline">{name}</span>
            <span className="sm:hidden">{dayNamesHebrew[index]}</span>
          </div>
        ))}
      </div>

      {/* Calendar grid - week by week */}
      <div className="bg-white">
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="grid grid-cols-7">
            {week.map((day) => (
              <DayCell
                key={format(day, 'yyyy-MM-dd')}
                date={day}
                isCurrentMonth={isSameMonth(day, currentDate)}
                tasks={tasks}
                taskAssignees={taskAssignees}
                drivers={drivers}
                clients={clients}
                onTaskClick={onTaskClick}
                onDayClick={onDayClick}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
