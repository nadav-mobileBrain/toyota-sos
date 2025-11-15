'use client';

import dayjs from '@/lib/dayjs';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import React, { useState, useEffect, useRef } from 'react';
import { TaskCard, TaskCardProps } from '@/components/driver/TaskCard';
import { TaskSkeleton } from '@/components/driver/TaskSkeleton';
import { getDriverSession } from '@/lib/auth';
import { useAuth } from '@/components/AuthProvider';

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
  const { client } = useAuth();
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
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
  useEffect(() => {
    fetchPageRef.current = async (reset: boolean) => {
      if (!client) {
        return;
      }

      if (reset) {
        setIsInitialLoading(true);
        setError(null);
      }

      const supa = client;

      // Get driver session from localStorage to pass driver_id if auth.uid() is null
      const driverSession = getDriverSession();
      const driverId = driverSession?.userId || null;

      const params: Record<string, unknown> = {
        p_tab: tabState,
        p_limit: 10,
      };
      if (!reset && cursor) {
        params.p_cursor_updated = cursor.updated_at;
        params.p_cursor_id = cursor.id;
      }
      // Pass driver_id if available (for localStorage-only sessions)
      if (driverId) {
        params.p_driver_id = driverId;
      }

      // eslint-disable-next-line no-console
      console.log('[DriverHome] get_driver_tasks params', params);

      const { data, error } = (await supa.rpc('get_driver_tasks', params)) as {
        data: SupaTaskRow[] | null;
        error: any | null;
      };
      if (error) {
        // eslint-disable-next-line no-console
        console.error('[DriverHome] get_driver_tasks RPC error', error);
        setError('טעינת משימות נכשלה. נסה שוב.');
        setIsInitialLoading(false);
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
        setCursor({
          updated_at: data[data.length - 1].updated_at,
          id: last.id,
        });
      }
      setIsInitialLoading(false);
    };
  }, [tabState, cursor, client]);

  // Initial load and on tab changes, trigger fetch once client is ready
  useEffect(() => {
    if (!client) return;
    fetchPageRef.current(true);
  }, [tabState, client]);

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

  return (
    <div
      className="space-y-4"
      onPointerDown={(e: React.PointerEvent<HTMLDivElement>) => {
        const scrollTop =
          typeof window !== 'undefined'
            ? window.scrollY || document.documentElement.scrollTop
            : 0;
        if (scrollTop <= 0) {
          isPullingRef.current = true;
          pullStartYRef.current = e.clientY;
          setPullDistance(0);
        }
      }}
      onPointerMove={(e: React.PointerEvent<HTMLDivElement>) => {
        if (!isPullingRef.current || pullStartYRef.current === null) return;
        const delta = e.clientY - pullStartYRef.current;
        if (delta > 0) {
          const dampened = Math.min(120, delta * 0.6);
          setPullDistance(dampened);
          e.preventDefault();
        } else {
          setPullDistance(0);
        }
      }}
      onPointerUp={async () => {
        const shouldRefresh = pullDistance >= PULL_THRESHOLD_PX;
        isPullingRef.current = false;
        pullStartYRef.current = null;
        if (shouldRefresh) {
          setIsRefreshing(true);
          try {
            setCursor(null);
            setHasMore(true);
            setRemoteTasks([]);
            await fetchPageRef.current(true);
          } finally {
            setIsRefreshing(false);
            setPullDistance(0);
          }
        } else {
          setPullDistance(0);
        }
      }}
      onPointerCancel={() => {
        isPullingRef.current = false;
        pullStartYRef.current = null;
        setPullDistance(0);
      }}
    >
      {/* Pull-to-refresh indicator */}
      <div
        className="flex items-center justify-center text-sm text-gray-500"
        style={{
          height: pullDistance ? Math.min(80, pullDistance) : 0,
          transition: isRefreshing ? 'height 150ms ease' : undefined,
        }}
        aria-live="polite"
        role="status"
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
        {(
          [
            { key: 'today', label: 'היום' },
            { key: 'all', label: 'הכל' },
            { key: 'overdue', label: 'איחורים' },
          ] as const
        ).map((t) => {
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
      {isInitialLoading ? (
        <div className="space-y-3" role="status" aria-live="polite">
          <TaskSkeleton />
          <TaskSkeleton />
          <TaskSkeleton />
        </div>
      ) : (
        <div className="space-y-3">
          {error ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-red-800">
              <div className="flex items-center justify-between">
                <span>אירעה שגיאה בטעינת המשימות</span>
                <button
                  type="button"
                  className="rounded-md bg-red-600 px-3 py-1 text-white text-sm"
                  onClick={() => fetchPageRef.current(true)}
                >
                  נסה שוב
                </button>
              </div>
            </div>
          ) : null}

          <ul className="space-y-3" role="list" aria-busy={isRefreshing}>
            {remoteTasks.map((task) => (
              <li key={task.id} role="listitem">
                <TaskCard {...task} />
              </li>
            ))}
          </ul>

          {!error && remoteTasks.length === 0 ? (
            <div className="text-center text-sm text-gray-500 py-10" aria-live="polite">
              אין משימות להצגה
            </div>
          ) : null}

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
      )}
    </div>
  );
}

// Re-export helpers for testing
export const __internal = { intersectsToday, isOverdue };
