'use client';

import React from 'react';
import type { TasksBoardProps } from '@/types/board';
import { PeriodProvider } from '@/components/admin/dashboard/PeriodContext';
import { PeriodFilter } from '@/components/admin/dashboard/PeriodFilter';
import { TasksBoard } from './TasksBoard';

function makeTodayRange() {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return {
    start: start.toISOString(),
    end: end.toISOString(),
    timezone: 'UTC' as const,
  };
}

export function AdminTasksShell(props: TasksBoardProps) {
  const initialRange = React.useMemo(() => makeTodayRange(), []);

  return (
    <PeriodProvider initial={initialRange}>
      <div className="space-y-4">
        <PeriodFilter />
        <TasksBoard {...props} />
      </div>
    </PeriodProvider>
  );
}
