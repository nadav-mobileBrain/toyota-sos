'use client';

import dayjs from '@/lib/dayjs';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import React, { useState, useEffect, useRef } from 'react';
import { TaskCard, TaskCardProps } from '@/components/driver/TaskCard';
import { createBrowserClient } from '@/lib/auth';

export type DriverTask = TaskCardProps;

function intersectsToday(
  start?: string | Date | null,
  end?: string | Date | null
): boolean {
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
  return (
    !!task.estimatedEnd &&
    task.status !== 'completed' &&
    dayjs(task.estimatedEnd).isBefore(dayjs())
  );
}

export function DriverHome() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const urlTab =
    (search.get('tab') as 'today' | 'all' | 'overdue' | null) ?? 'today';
  const [tabState, setTabState] = useState<'today' | 'all' | 'overdue'>(urlTab);

  // Pull-to-refresh state
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const pullStartYRef = useRef<number | null>(null);
  const isPullingRef = useRef(false);
  const PULL_THRESHOLD_PX = 64;

  const setTab = (next: 'today' | 'all' | 'overdue') => {
    const params = new URLSearchParams(search.toString());
    params.set('tab', next);
    router.replace(`${pathname}?${params.toString()}`);
    // Reset pagination state on tab switch
    setCursor(null);
    setHasMore(true);
    setRemoteTasks([]);
    setTabState(next);
  };

  // Remote paginated tasks via RPC
  const [remoteTasks, setRemoteTasks] = useState<DriverTask[]>([]);
  const [cursor, setCursor] = useState<{
    updated_at: string;
    id: string;
  } | null>(null);
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

  type SupaTaskRow = {
    id: string;
    title: string;
    type: DriverTask['type'];
    priority: DriverTask['priority'];
    status: DriverTask['status'];
    estimated_start: string | null;
    estimated_end: string | null;
    address: string | null;
    updated_at: string;
  };

  const fetchPageRef = useRef<(reset: boolean) => Promise<void>>(
    async () => {}
  );
  const refreshNowRef = useRef<() => Promise<void>>(async () => {});
  useEffect(() => {
    fetchPageRef.current = async (reset: boolean) => {
      const supa = createBrowserClient();
      const params: Record<string, unknown> = {
        p_tab: tabState,
        p_limit: 10,
      };
      if (!reset && cursor) {
        params.p_cursor_updated = cursor.updated_at;
        params.p_cursor_id = cursor.id;
      }
      const { data, error } = (await supa.rpc('get_driver_tasks', params)) as {
        data: SupaTaskRow[] | null;
        error: unknown | null;
      };
      if (error) {
        return;
      }
      const mapped: DriverTask[] = (data ?? []).map((t) => ({
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
      if (last && data && data.length > 0) {
        setCursor({ updated_at: data[data.length - 1].updated_at, id: last.id });
      }
    };
    refreshNowRef.current = async () => {
      setCursor(null);
      setHasMore(true);
      setRemoteTasks([]);
      await fetchPageRef.current(true);
    };
  }, [tabState, cursor]);

  // Initial load and on tab changes, trigger fetch
  useEffect(() => {
    fetchPageRef.current(true);
  }, [tabState]);

  // Supabase realtime: refetch on tasks/task_assignees changes (debounced)
  useEffect(() => {
    const supa = createBrowserClient();
    let debounceTimer: number | null = null;
    const schedule = () => {
      if (debounceTimer !== null) return;
      debounceTimer = window.setTimeout(async () => {
        debounceTimer = null;
        await refreshNowRef.current();
      }, 400);
    };
    const ch = supa
      .channel('driver-tasks')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
        () => schedule()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'task_assignees' },
        () => schedule()
      )
      .subscribe();
    return () => {
      if (debounceTimer !== null) {
        window.clearTimeout(debounceTimer);
      }
      supa.removeChannel(ch);
    };
  }, []);

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
            fetchPageRef.current(false).finally(() => setIsLoadingMore(false));
          }
        }
      },
      { rootMargin: '120px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, isLoadingMore]);

  // Pull-to-refresh handlers on the container
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only start pulling if at top of page
    const scrollTop =
      typeof window !== 'undefined'
        ? window.scrollY || document.documentElement.scrollTop
        : 0;
    if (scrollTop <= 0) {
      isPullingRef.current = true;
      pullStartYRef.current = e.clientY;
      setPullDistance(0);
    }
  };
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPullingRef.current || pullStartYRef.current === null) return;
    const delta = e.clientY - pullStartYRef.current;
    if (delta > 0) {
      // apply a dampening factor for nicer feel
      const dampened = Math.min(120, delta * 0.6);
      setPullDistance(dampened);
      // prevent native overscroll glow
      e.preventDefault();
    } else {
      setPullDistance(0);
    }
  };
  const endPull = async () => {
    const shouldRefresh = pullDistance >= PULL_THRESHOLD_PX;
    isPullingRef.current = false;
    pullStartYRef.current = null;
    if (shouldRefresh) {
      setIsRefreshing(true);
      try {
        await refreshNowRef.current();
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  };
  const handlePointerUp = async () => {
    await endPull();
  };
  const handlePointerCancel = async () => {
    await endPull();
  };

  return (
    <div
      className="space-y-4"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
    >
      {/* Pull-to-refresh indicator */}
      <div
        className="flex items-center justify-center text-sm text-gray-500"
        style={{
          height: pullDistance ? Math.min(80, pullDistance) : 0,
          transition: isRefreshing ? 'height 150ms ease' : undefined,
        }}
        aria-live="polite"
      >
        {isRefreshing ? (
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-transparent" />
        ) : pullDistance > 0 ? (
          <span>
            {pullDistance >= PULL_THRESHOLD_PX ? 'שחרר לרענון' : 'משוך לרענון'}
          </span>
        ) : null}
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-3 gap-2">
        {([{ key: 'today', label: 'היום' }, { key: 'all', label: 'הכל' }, { key: 'overdue', label: 'איחורים' }] as const).map((t) => {
          type TabKey = typeof t.key;
          const active = tabState === (t.key as TabKey);
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key as TabKey)}
              className={[
                'rounded-md py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-toyota-primary text-white'
                  : 'bg-gray-100 text-gray-800 hover:bg-gray-200',
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
        {remoteTasks.length === 0 ? <div className="text-center text-sm text-gray-500 py-10">אין משימות להצגה</div> : null}

        {/* Load more button (fallback) */}
        {hasMore ? (
          <div className="flex justify-center">
            <button
              type="button"
              className="rounded-md bg-gray-100 px-4 py-2 text-sm hover:bg-gray-200"
              disabled={isLoadingMore}
              onClick={() => fetchPageRef.current(false)}
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
