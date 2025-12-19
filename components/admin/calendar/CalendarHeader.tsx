'use client';

import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Filter,
  Calendar,
  CalendarDays,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { CalendarView } from '@/types/task';

interface CalendarHeaderProps {
  view: CalendarView;
  currentDate: Date;
  dateRange: { start: Date; end: Date };
  onViewChange: (view: CalendarView) => void;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  onCreateTask: () => void;
  onToggleFilters: () => void;
  activeFiltersCount: number;
  showFilters: boolean;
}

export function CalendarHeader({
  view,
  currentDate,
  dateRange,
  onViewChange,
  onPrevious,
  onNext,
  onToday,
  onCreateTask,
  onToggleFilters,
  activeFiltersCount,
  showFilters,
}: CalendarHeaderProps) {
  // Format date range for display
  const getDateRangeLabel = () => {
    if (view === 'week') {
      const startMonth = format(dateRange.start, 'MMMM', { locale: he });
      const endMonth = format(dateRange.end, 'MMMM', { locale: he });
      const year = format(dateRange.end, 'yyyy');

      if (startMonth === endMonth) {
        return `${format(dateRange.start, 'd', { locale: he })}-${format(
          dateRange.end,
          'd',
          { locale: he }
        )} ${startMonth} ${year}`;
      } else {
        return `${format(dateRange.start, 'd MMM', { locale: he })} - ${format(
          dateRange.end,
          'd MMM',
          { locale: he }
        )} ${year}`;
      }
    } else {
      return format(currentDate, 'MMMM yyyy', { locale: he });
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      {/* Left side: Navigation and date */}
      <div className="flex items-center gap-3">
        {/* Navigation buttons */}
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            onClick={onNext}
            className="h-9 w-9"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={onPrevious}
            className="h-9 w-9"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>

        {/* Today button */}
        <Button variant="outline" size="sm" onClick={onToday}>
          היום
        </Button>

        {/* Date range label */}
        <h2 className="text-lg font-semibold text-slate-900">
          {getDateRangeLabel()}
        </h2>
      </div>

      {/* Right side: View toggle, filters, create */}
      <div className="flex items-center gap-3">
        {/* View toggle */}
        <ToggleGroup
          type="single"
          value={view}
          onValueChange={(v) => v && onViewChange(v as CalendarView)}
          className="bg-slate-100 rounded-lg p-1"
        >
          <ToggleGroupItem
            value="week"
            className="data-[state=on]:bg-blue-600 data-[state=on]:shadow-sm data-[state=on]:text-white px-3 py-1.5 text-sm rounded-md text-black"
          >
            <Calendar className="h-4 w-4 ml-1.5 " />
            שבוע
          </ToggleGroupItem>
          <ToggleGroupItem
            value="month"
            className="data-[state=on]:bg-blue-600 data-[state=on]:shadow-sm data-[state=on]:text-white px-3 py-1.5 text-sm rounded-md text-black"
          >
            <CalendarDays className="h-4 w-4 ml-1.5" />
            חודש
          </ToggleGroupItem>
        </ToggleGroup>

        {/* Filters button */}
        <Button
          variant={showFilters ? 'default' : 'outline'}
          size="sm"
          onClick={onToggleFilters}
          className="relative"
        >
          <Filter className="h-4 w-4 ml-1.5" />
          סינון
          {activeFiltersCount > 0 && (
            <span className="absolute -top-1.5 -left-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-toyota-red text-xs font-bold text-white">
              {activeFiltersCount}
            </span>
          )}
        </Button>

        {/* Create task button */}
        <Button
          onClick={onCreateTask}
          className="bg-toyota-red hover:bg-toyota-red/90 text-white"
        >
          <Plus className="h-4 w-4 ml-1.5" />
          משימה חדשה
        </Button>
      </div>
    </div>
  );
}
