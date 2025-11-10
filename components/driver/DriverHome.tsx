'use client';

import dayjs from '@/lib/dayjs';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { TaskCard, TaskCardProps } from '@/components/driver/TaskCard';
import { createBrowserClient } from '@/lib/auth';

export type DriverTask = TaskCardProps;

function intersectsToday(start?: string | Date | null, end?: string | Date | null): boolean {
  const todayStart = dayjs().startOf('day');
  const todayEnd = dayjs().endOf('day');
  const s = start ? dayjs(start) : null;
  const e = end ? dayjs(end) : null;

  if (s && e) {
    // range intersects today
    return s.isBefore(todayEnd) && e.isAfter(todayStart);
  }
  if (s) return s.isAfter(todayStart) && s.isBefore(todayEnd);
  if (e) return e.isAfter(todayStart) && e.isBefore(todayEnd);
  return false;
}

function isOverdue(task: DriverTask): boolean {
  return !!task.estimatedEnd && task.status !== 'completed' && dayjs(task.estimatedEnd).isBefore(dayjs());
}

export function DriverHome({ tasks }: { tasks: DriverTask[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const urlTab = (search.get('tab') as 'today' | 'all' | 'overdue' | null) ?? 'today';
  const [tabState, setTabState] = useState<'today' | 'all' | 'overdue'>(urlTab);

  const setTab = (next: 'today' | 'all' | 'overdue') => {
    const params = new URLSearchParams(search.toString());
    params.set('tab', next);
    router.replace(`${pathname}?${params.toString()}`);
    setTabState(next);
  };

  // Remote paginated tasks via RPC
  const [remoteTasks, setRemoteTasks] = useState<DriverTask[]>([]);
  const [cursor, setCursor] = useState<{ updated_at: string; id: string } | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  function mergeById(prev: DriverTask[], next: DriverTask[]): DriverTask[] {
    if (!prev.length) return next;
    const map = new Map<string, DriverTask>();
    for (const t of prev) map.set(t.id, t);
    for (const t of next) if (!map.has(t.id)) map.set(t.id, t);
    return Array.from(map.values());
  }

  async function fetchPage(reset: boolean) {
    const supa = createBrowserClient();
    const params: any = {
      p_tab: tabState,
      p_limit: 10,
    };
    if (!reset && cursor) {
      params.p_cursor_updated = cursor.updated_at;
      params.p_cursor_id = cursor.id;
    }
    const { data, error } = await supa.rpc('get_driver_tasks', params);
    if (error) {
      // eslint-disable-next-line no-console
      console.error('get_driver_tasks error', error);
      return;
    }
    const mapped: DriverTask[] = (data ?? []).map((t: any) => ({
      id: t.id,
      title: t.title,
      type: t.type,
      priority: t.priority,
      status: t.status,
      estimatedStart: t.estimated_start,
      estimatedEnd: t.estimated_end,
      address: t.address,
      clientName: null,
      vehicle: null,
    }));
    setRemoteTasks((prev) => (reset ? mapped : mergeById(prev, mapped)));
    setHasMore((mapped?.length ?? 0) === 10);
    const last = mapped?.[mapped.length - 1];
    if (last) {
      setCursor({ updated_at: (data[data.length - 1] as any).updated_at, id: last.id });
    }
  }

  // Initial and tab changes
  useEffect(() => {
    setCursor(null);
    setHasMore(true);
    fetchPage(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabState]);

  // IntersectionObserver to auto-load next page (server pagination)
  useEffect(() => {
    if (!hasMore) return;
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !isLoadingMore) {
            setIsLoadingMore(true);
            fetchPage(false).finally(() => setIsLoadingMore(false));
          }
        }
      },
      { rootMargin: '120px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, isLoadingMore]);

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { key: 'today', label: 'היום' },
          { key: 'all', label: 'הכל' },
          { key: 'overdue', label: 'איחורים' },
        ].map((t) => {
          const active = tabState === (t.key as any);
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key as any)}
              className={[
                'rounded-md py-2 text-sm font-medium transition-colors',
                active ? 'bg-toyota-primary text-white' : 'bg-gray-100 text-gray-800 hover:bg-gray-200',
              ].join(' ')}
              aria-pressed={active}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* List */}
      <div className="space-y-3">
        {remoteTasks.map((task) => (
          <TaskCard key={task.id} {...task} />
        ))}
        {remoteTasks.length === 0 ? (
          <div className="text-center text-sm text-gray-500 py-10">אין משימות להצגה</div>
        ) : null}

        {/* Load more button (fallback) */}
        {hasMore ? (
          <div className="flex justify-center">
            <button
              type="button"
              className="rounded-md bg-gray-100 px-4 py-2 text-sm hover:bg-gray-200"
              disabled={isLoadingMore}
              onClick={() => fetchPage(false)}
            >
              {isLoadingMore ? 'טוען…' : 'טען עוד'}
            </button>
          </div>
        ) : null}

        {/* Sentinel for infinite scroll */}
        <div ref={sentinelRef} />
      </div>
    </div>
  );
}

// Re-export helpers for testing
export const __internal = { intersectsToday, isOverdue };


