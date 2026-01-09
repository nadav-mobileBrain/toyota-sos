/* eslint-disable max-lines */
'use client';

import dayjs from '@/lib/dayjs';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import React, { useState, useEffect, useRef } from 'react';
import { TaskCard, TaskCardProps } from '@/components/driver/TaskCard';
import type { AdvisorColor } from '@/types/task';
import { TaskSkeleton } from '@/components/driver/TaskSkeleton';
import { getDriverSession } from '@/lib/auth';
import { useAuth } from '@/components/AuthProvider';
import { Button } from '@/components/ui/button';
import { ChecklistModal } from '@/components/driver/ChecklistModal';
import {
  getStartChecklistForTaskType,
  getCompletionChecklistForTaskType,
  getCompletionFlowForTaskType,
} from '@/components/driver/checklists';
import { ReplacementCarDeliveryForm } from '@/components/driver/ReplacementCarDeliveryForm';
import { TestCompletionPopup } from '@/components/driver/TestCompletionPopup';
import { toastSuccess, toastError } from '@/lib/toast';
import { checkExistingAttachments } from '@/lib/taskAttachments';
import { UtensilsIcon } from 'lucide-react';
import { track } from '@/lib/mixpanel';

function getChecklistInfo(type: string) {
  switch (type) {
    case 'ביצוע טסט':
      return {
        title: 'צ׳ק-ליסט לפני יציאה לטסט',
        description: 'לפני תחילת ביצוע טסט, אשר שאספת את כל המסמכים הנדרשים.',
      };
    case 'איסוף רכב/שינוע':
      return {
        title: 'צ׳ק-ליסט איסוף רכב',
        description: 'אנא וודא שביצעת את כל הפעולות הנדרשות לפני האיסוף.',
      };
    case 'איסוף רכב/שינוע+טסט':
      return {
        title: 'צ׳ק-ליסט איסוף רכב וטסט',
        description: 'אנא וודא שביצעת את כל הפעולות הנדרשות לפני האיסוף והטסט.',
      };
    case 'החזרת רכב/שינוע':
      return {
        title: 'צ׳ק-ליסט החזרת רכב',
        description: 'אנא וודא שביצעת את כל הפעולות הנדרשות לפני ההחזרה.',
      };
    case 'מסירת רכב חלופי':
      return {
        title: 'צ׳ק-ליסט מסירת רכב חלופי',
        description: 'אנא וודא שביצעת את כל הפעולות הנדרשות לפני תחילת העבודה.',
      };
    default:
      return {
        title: 'צ׳ק-ליסט',
        description: 'אנא מלא את הפרטים הבאים.',
      };
  }
}

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
    task.status !== 'הושלמה' &&
    dayjs(task.estimatedEnd).isBefore(dayjs())
  );
}

export function DriverHome() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const { client, error: authError } = useAuth();
  const urlTab =
    (search.get('tab') as 'today' | 'all' | 'overdue' | 'forms' | null) ??
    'today';
  const [tabState, setTabState] = useState<
    'today' | 'all' | 'overdue' | 'forms'
  >(urlTab);

  // Pull-to-refresh state
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const pullStartYRef = useRef<number | null>(null);
  const isPullingRef = useRef(false);
  const PULL_THRESHOLD_PX = 64;

  // Handle auth errors
  useEffect(() => {
    if (!client && authError) {
      setError(authError);
      setIsInitialLoading(false);
    }
  }, [client, authError]);

  const setTab = (next: 'today' | 'all' | 'overdue' | 'forms') => {
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
    estimated_start: string;
    id: string;
  } | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Break state
  const [isOnBreak, setIsOnBreak] = useState(false);
  const [breakLoading, setBreakLoading] = useState(false);

  // Checklist flow state: when a status change requires a start checklist
  const [checklistState, setChecklistState] = useState<{
    task: DriverTask;
    nextStatus: DriverTask['status'];
  } | null>(null);

  // Completion checklist state: when moving to 'הושלמה' requires a completion checklist
  const [completionChecklistState, setCompletionChecklistState] = useState<{
    task: DriverTask;
    nextStatus: DriverTask['status'];
    allowSkip?: boolean;
  } | null>(null);

  // Completion form state
  const [completionFormState, setCompletionFormState] = useState<{
    task: DriverTask;
    nextStatus: DriverTask['status'];
    hasExistingAttachments?: import('@/lib/taskAttachments').ExistingAttachments;
  } | null>(null);

  // Test completion popup state
  const [testCompletionState, setTestCompletionState] = useState<{
    task: DriverTask;
    nextStatus: DriverTask['status'];
  } | null>(null);

  const driverId = getDriverSession()?.userId || null;

  function mergeById(prev: DriverTask[], next: DriverTask[]): DriverTask[] {
    if (!prev.length) return next;
    const map = new Map<string, DriverTask>();
    for (const t of prev) map.set(t.id, t);
    for (const t of next) if (!map.has(t.id)) map.set(t.id, t);
    return Array.from(map.values());
  }

  type SupaTaskRow = {
    advisor_name?: string | null;
    advisor_color?: AdvisorColor | null;
    id: string;
    type: DriverTask['type'];
    priority: DriverTask['priority'];
    status: DriverTask['status'];
    estimated_start: string | null;
    estimated_end: string | null;
    address: string | null;
    client_name: string | null;
    client_phone: string | null;
    vehicle_license_plate: string | null;
    vehicle_model: string | null;
    client_vehicle_plate: string | null;
    client_vehicle_model: string | null;
    distance_from_garage: number | null;
    details: string | null;
    updated_at: string;
    is_lead_driver: boolean;
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
        params.p_cursor_start = cursor.estimated_start;
        params.p_cursor_id = cursor.id;
      }
      // Pass driver_id if available (for localStorage-only sessions)
      if (driverId) {
        params.p_driver_id = driverId;
      }

      const { data, error } = (await supa.rpc('get_driver_tasks', params)) as {
        data: SupaTaskRow[] | null;
        error: Error | null;
      };
      if (error) {
        console.error('[DriverHome] get_driver_tasks RPC error', error);
        setError('טעינת משימות נכשלה. נסה שוב.');
        setIsInitialLoading(false);
        return;
      }
      const mapped: DriverTask[] = (data ?? []).map((t) => ({
        id: t.id,
        type: t.type,
        priority: t.priority,
        status: t.status,
        estimatedStart: t.estimated_start,
        estimatedEnd: t.estimated_end,
        address: t.address,
        distanceFromGarage: t.distance_from_garage,
        clientName: t.client_name,
        clientPhone: t.client_phone,
        advisorName: t.advisor_name || null,
        advisorColor: (t.advisor_color as AdvisorColor) || null,
        vehicle: t.vehicle_license_plate
          ? {
              licensePlate: t.vehicle_license_plate,
              model: t.vehicle_model,
            }
          : null,
        clientVehicle: t.client_vehicle_plate
          ? {
              licensePlate: t.client_vehicle_plate,
              model: t.client_vehicle_model,
            }
          : null,
        details: t.details || null,
        isSecondaryDriver: t.is_lead_driver === false,
      }));

      const taskIds = mapped.map((t) => t.id);

      if (client && taskIds.length > 0) {
        const { data: stopRows, error: stopsError } = await client
          .from('task_stops')
          .select(
            'task_id, address, advisor_name, advisor_color, phone, sort_order, distance_from_garage, client:clients(id,name,phone)'
          )
          .in('task_id', taskIds)
          .order('sort_order', { ascending: true });

        if (!stopsError && Array.isArray(stopRows)) {
          const grouped = new Map<string, DriverTask['stops']>();
          for (const row of stopRows) {
            // Handle client as either single object or array (Supabase may return array for relationships)
            const clientData = Array.isArray(row.client)
              ? row.client[0] || null
              : row.client;

            const entry = grouped.get(row.task_id) || [];
            // Use phone from stop if exists, otherwise fallback to client's phone
            const phone = row.phone || clientData?.phone || null;
            entry.push({
              address: row.address || '',
              distanceFromGarage: row.distance_from_garage || null,
              clientName: clientData?.name || null,
              clientPhone: phone,
              advisorName: row.advisor_name || null,
              advisorColor: (row.advisor_color as AdvisorColor) || null,
            });
            grouped.set(row.task_id, entry);
          }
          for (const task of mapped) {
            if (!grouped.has(task.id)) continue;
            task.stops = grouped.get(task.id) || [];
            if (task.stops.length > 0) {
              task.address = task.stops[0].address;
              task.clientName = task.stops[0].clientName || task.clientName;
              task.clientPhone = task.stops[0].clientPhone || task.clientPhone;
            }
          }
        }
      }
      setRemoteTasks((prev) => (reset ? mapped : mergeById(prev, mapped)));
      setHasMore((mapped?.length ?? 0) === 10);
      const last = mapped?.[mapped.length - 1];
      if (last && data && data.length > 0) {
        const lastRow = data[data.length - 1];
        setCursor({
          estimated_start: lastRow.estimated_start || new Date().toISOString(),
          id: last.id,
        });
      }
      setIsInitialLoading(false);
    };
  }, [tabState, cursor, client]);

  // Check break status on mount
  useEffect(() => {
    const checkBreakStatus = async () => {
      try {
        const localSession = getDriverSession();
        const driverId = localSession?.userId;
        const url = driverId
          ? `/api/driver/break?user_id=${encodeURIComponent(driverId)}`
          : '/api/driver/break';
        const res = await fetch(url, {
          credentials: 'include', // Include cookies
          headers: driverId ? { 'x-toyota-user-id': driverId } : undefined,
        });
        if (res.ok) {
          const json = await res.json();
          if (json.ok) {
            setIsOnBreak(json.data.isOnBreak);
          }
        }
      } catch {
        // Silent error handling
      }
    };
    checkBreakStatus();
  }, []);

  // Handle break start/end
  const handleBreakToggle = async () => {
    if (breakLoading) return;

    setBreakLoading(true);
    try {
      const localSession = getDriverSession();
      const driverId = localSession?.userId;
      if (isOnBreak) {
        // End break
        const res = await fetch('/api/driver/break', {
          method: 'PATCH',
          credentials: 'include',
          headers: driverId ? { 'x-toyota-user-id': driverId } : undefined,
        });
        if (res.ok) {
          const json = await res.json();
          if (json.ok) {
            setIsOnBreak(false);
            track('Driver End Break', { driverId });
            toastSuccess('הפסקה הסתיימה');
          } else {
            toastError('שגיאה בסיום הפסקה');
          }
        } else {
          const errorData = await res
            .json()
            .catch(() => ({ error: 'Unknown error' }));
          toastError(errorData.error || 'שגיאה בסיום הפסקה');
        }
      } else {
        // Start break
        const res = await fetch('/api/driver/break', {
          method: 'POST',
          credentials: 'include',
          headers: driverId ? { 'x-toyota-user-id': driverId } : undefined,
        });
        if (res.ok) {
          const json = await res.json();
          if (json.ok) {
            setIsOnBreak(true);
            track('Driver Start Break', { driverId });
            toastSuccess('הפסקה התחילה');
          } else {
            toastError('שגיאה בהתחלת הפסקה');
          }
        } else {
          const errorData = await res
            .json()
            .catch(() => ({ error: 'Unknown error' }));
          toastError(errorData.error || 'שגיאה בהתחלת הפסקה');
        }
      }
    } catch {
      toastError('שגיאה בפעולת הפסקה');
    } finally {
      setBreakLoading(false);
    }
  };

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

  // Realtime: refresh driver tasks when tasks or assignments change (admin updates/new tasks)
  useEffect(() => {
    if (!client) return;

    console.log('[DriverHome] Setting up realtime subscription...');

    // Check if user is authenticated for realtime
    client.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        console.error(
          '❌ [DriverHome] No Supabase auth session - Realtime will not work!'
        );
        console.error(
          '⚠️ Driver must login with proper credentials for Realtime to work'
        );
      } else {
        console.log(
          '✅ [DriverHome] Driver has valid auth session:',
          session.user.id
        );
      }
    });

    // Create unique channel name to avoid collisions (especially in React StrictMode)
    const channelName = `driver-tasks-${Date.now()}`;

    // Simple realtime setup - similar pattern to the working admin TasksBoard
    const channel = client
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
        () => {
          console.log('[DriverHome] tasks change received, refreshing...');
          fetchPageRef.current(true);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'task_assignees' },
        () => {
          console.log(
            '[DriverHome] task_assignees change received, refreshing...'
          );
          fetchPageRef.current(true);
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log(
            '[DriverHome] ✅ Successfully subscribed to realtime updates'
          );
        } else if (status === 'TIMED_OUT') {
          console.warn(
            '[DriverHome] ⚠️ Subscription TIMED_OUT - This can happen in dev mode with React StrictMode',
            err
          );
          // Auto-retry after timeout (common in development with double-mounting)
          setTimeout(() => {
            console.log('[DriverHome] Retrying subscription...');
            channel.subscribe();
          }, 2000);
        } else if (status === 'CHANNEL_ERROR') {
          console.error(
            '[DriverHome] ❌ CHANNEL_ERROR - Check Supabase realtime config',
            err
          );
        }
      });

    return () => {
      try {
        client.removeChannel(channel);
      } catch {
        // ignore cleanup errors
      }
    };
  }, [client]);

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

      {/* Break Button */}
      <Button
        type="button"
        onClick={handleBreakToggle}
        disabled={breakLoading}
        className={[
          'w-full h-auto rounded-xl px-4 py-3 mb-2 justify-between',
          'shadow-sm hover:shadow-md transition-all',
          isOnBreak
            ? 'bg-orange-500 text-white hover:bg-orange-600'
            : 'bg-primary text-white hover:bg-gray-800',
        ].join(' ')}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span
            className={[
              'grid place-items-center h-9 w-9 rounded-full',
              isOnBreak ? 'bg-white/15' : 'bg-white/10',
            ].join(' ')}
            aria-hidden="true"
          >
            <UtensilsIcon className="h-4 w-4" />
          </span>
          <div className="min-w-0 text-right">
            <div className="text-sm font-semibold leading-5">
              {isOnBreak ? 'סיים הפסקה' : 'התחל הפסקה'}
            </div>
            <div className="text-xs opacity-90">
              {breakLoading
                ? isOnBreak
                  ? 'מסיים...'
                  : 'מתחיל...'
                : isOnBreak
                ? 'לחץ כדי לחזור לעבודה'
                : ''}
            </div>
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-2">
          {breakLoading && (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          )}
        </div>
      </Button>

      {/* Tabs */}
      <div className="grid grid-cols-1 gap-2">
        {(
          [
            { key: 'today', label: 'לוח משימות יומי' },
            // { key: 'all', label: 'הכל' },
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
                'rounded-md py-3 px-4 text-sm font-medium transition-colors',
                active
                  ? 'bg-toyota-gradient text-white shadow-md'
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
          {error || (!client && authError) ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-red-800">
              <div className="flex items-center justify-between">
                <span>
                  {error || authError || 'אירעה שגיאה בטעינת המשימות'}
                </span>
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
                <TaskCard
                  {...task}
                  onStatusChange={async (next) => {
                    if (!client || next === task.status) return;

                    // If moving into "בעבודה" and this task type has a start checklist,
                    // open the checklist modal instead of immediately updating status.
                    if (next === 'בעבודה') {
                      const schema = getStartChecklistForTaskType(task.type);
                      if (schema && schema.length > 0) {
                        setChecklistState({ task, nextStatus: next });
                        return;
                      }
                    }

                    // If moving into "הושלמה" and this task type has a completion checklist,
                    // open the checklist modal instead of immediately updating status.
                    if (next === 'הושלמה') {
                      // First check for completion checklist
                      const completionChecklist =
                        getCompletionChecklistForTaskType(task.type);
                      if (
                        completionChecklist &&
                        completionChecklist.length > 0
                      ) {
                        // For "מסירת רכב חלופי", check if attachments already exist
                        if (task.type === 'מסירת רכב חלופי') {
                          const existingAttachments =
                            await checkExistingAttachments(task.id);
                          if (existingAttachments.hasAllRequired) {
                            // All attachments exist, allow skipping checklist
                            setCompletionChecklistState({
                              task,
                              nextStatus: next,
                              allowSkip: true,
                            });
                          } else {
                            // Missing attachments, require checklist
                            setCompletionChecklistState({
                              task,
                              nextStatus: next,
                              allowSkip: false,
                            });
                          }
                        } else {
                          setCompletionChecklistState({
                            task,
                            nextStatus: next,
                          });
                        }
                        return;
                      }

                      // Then check for special completion flows
                      const completionFlow = getCompletionFlowForTaskType(
                        task.type
                      );
                      if (completionFlow === 'replacement_car_delivery') {
                        // Check if attachments already exist
                        const existingAttachments =
                          await checkExistingAttachments(task.id);
                        setCompletionFormState({
                          task,
                          nextStatus: next,
                          hasExistingAttachments: existingAttachments,
                        });
                        return;
                      }
                      if (completionFlow === 'test_completion') {
                        setTestCompletionState({ task, nextStatus: next });
                        return;
                      }
                    }

                    const { error: upErr } = await client.rpc(
                      'update_task_status',
                      {
                        p_task_id: task.id,
                        p_status: next,
                        p_driver_id: driverId || undefined,
                      }
                    );
                    if (upErr) {
                      // Check if this is the specific validation error for skipping status flow
                      const errorMessage = upErr.message || '';
                      if (errorMessage.includes('INVALID_STATUS_FLOW')) {
                        toastError(
                          'המשימה חייבת להיות בסטטוס "בביצוע" לפני שניתן להשלים אותה',
                          5000
                        );
                      } else {
                        toastError('שגיאה בעדכון סטטוס המשימה');
                      }
                      return;
                    }
                    setRemoteTasks((prev) =>
                      prev.map((t) =>
                        t.id === task.id ? { ...t, status: next } : t
                      )
                    );
                    toastSuccess('סטטוס המשימה עודכן בהצלחה');
                  }}
                />
              </li>
            ))}
          </ul>
          {!error && remoteTasks.length === 0 ? (
            <div
              className="text-center text-sm text-gray-500 py-10"
              aria-live="polite"
            >
              אין משימות להצגה
            </div>
          ) : null}
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

      {/* Mandatory start checklist for specific task types (e.g. licence_test / "ביצוע טסט") */}
      {checklistState ? (
        <ChecklistModal
          open={!!checklistState}
          onOpenChange={(open) => {
            if (!open) {
              setChecklistState(null);
            }
          }}
          schema={getStartChecklistForTaskType(checklistState.task.type) ?? []}
          {...getChecklistInfo(checklistState.task.type)}
          persist
          taskId={checklistState.task.id}
          driverId={driverId || undefined}
          forceCompletion
          onSubmit={async () => {
            if (!client || !checklistState) return;
            const { error: upErr } = await client.rpc('update_task_status', {
              p_task_id: checklistState.task.id,
              p_status: checklistState.nextStatus,
              p_driver_id: driverId || undefined,
            });
            if (upErr) {
              const errorMessage = upErr.message || '';
              if (errorMessage.includes('INVALID_STATUS_FLOW')) {
                toastError(
                  'המשימה חייבת להיות בסטטוס "בביצוע" לפני שניתן להשלים אותה',
                  5000
                );
              } else {
                toastError('שגיאה בעדכון סטטוס המשימה');
              }
              return;
            }
            setRemoteTasks((prev) =>
              prev.map((t) =>
                t.id === checklistState.task.id
                  ? { ...t, status: checklistState.nextStatus }
                  : t
              )
            );
            toastSuccess('המשימה עודכנה בהצלחה');
            setChecklistState(null);
          }}
        />
      ) : null}

      {/* Mandatory completion checklist for specific task types (e.g. "איסוף רכב/שינוע") */}
      {completionChecklistState ? (
        <ChecklistModal
          open={!!completionChecklistState}
          onOpenChange={(open) => {
            if (!open) {
              setCompletionChecklistState(null);
            }
          }}
          schema={
            getCompletionChecklistForTaskType(
              completionChecklistState.task.type
            ) ?? []
          }
          title={
            completionChecklistState.task.type === 'מסירת רכב חלופי'
              ? 'צ׳ק-ליסט לפני מסירת רכב חלופי'
              : completionChecklistState.task.type === 'ביצוע טסט'
              ? 'צ׳ק-ליסט השלמת טסט'
              : 'צ׳ק-ליסט השלמת איסוף רכב'
          }
          description={
            completionChecklistState.task.type === 'מסירת רכב חלופי'
              ? completionChecklistState.allowSkip
                ? 'נמצאו תמונות וחתימה קיימות. ניתן לדלג על הצ׳ק-ליסט ולהשתמש בתמונות הקיימות, או להעלות תמונות נוספות.'
                : 'אנא וודא שביצעת את כל הפעולות הנדרשות לפני המשך למסירת הרכב.'
              : completionChecklistState.task.type === 'ביצוע טסט'
              ? 'אנא וודא שביצעת את כל הפעולות הנדרשות לפני השלמת הטסט.'
              : 'אנא וודא שביצעת את כל הפעולות הנדרשות לפני השלמת המשימה.'
          }
          persist
          taskId={completionChecklistState.task.id}
          driverId={driverId || undefined}
          forceCompletion={!completionChecklistState.allowSkip}
          onSkip={
            completionChecklistState.allowSkip &&
            completionChecklistState.task.type === 'מסירת רכב חלופי'
              ? async () => {
                  if (!completionChecklistState) return;
                  setCompletionChecklistState(null);
                  const existingAttachments = await checkExistingAttachments(
                    completionChecklistState.task.id
                  );
                  setCompletionFormState({
                    task: completionChecklistState.task,
                    nextStatus: completionChecklistState.nextStatus,
                    hasExistingAttachments: existingAttachments,
                  });
                }
              : undefined
          }
          onSubmit={async () => {
            if (!completionChecklistState) return;

            // For "מסירת רכב חלופי", after checklist completion, proceed to the special form
            const completionFlow = getCompletionFlowForTaskType(
              completionChecklistState.task.type
            );
            if (completionFlow === 'replacement_car_delivery') {
              setCompletionChecklistState(null);
              const existingAttachments = await checkExistingAttachments(
                completionChecklistState.task.id
              );
              setCompletionFormState({
                task: completionChecklistState.task,
                nextStatus: completionChecklistState.nextStatus,
                hasExistingAttachments: existingAttachments,
              });
              return;
            }

            // For "ביצוע טסט", after checklist completion, proceed to the test completion popup
            if (completionFlow === 'test_completion') {
              setCompletionChecklistState(null);
              setTestCompletionState({
                task: completionChecklistState.task,
                nextStatus: completionChecklistState.nextStatus,
              });
              return;
            }

            // For other task types, update status directly
            if (!client) return;
            const { error: upErr } = await client.rpc('update_task_status', {
              p_task_id: completionChecklistState.task.id,
              p_status: completionChecklistState.nextStatus,
              p_driver_id: driverId || undefined,
            });
            if (upErr) {
              const errorMessage = upErr.message || '';
              if (errorMessage.includes('INVALID_STATUS_FLOW')) {
                toastError(
                  'המשימה חייבת להיות בסטטוס "בביצוע" לפני שניתן להשלים אותה',
                  5000
                );
              } else {
                toastError('שגיאה בעדכון סטטוס המשימה');
              }
              return;
            }
            setRemoteTasks((prev) =>
              prev.map((t) =>
                t.id === completionChecklistState.task.id
                  ? { ...t, status: completionChecklistState.nextStatus }
                  : t
              )
            );
            toastSuccess('המשימה בוצעה בהצלחה');
            setCompletionChecklistState(null);
          }}
        />
      ) : null}

      {/* Completion form for Replacement Car Delivery */}
      {completionFormState ? (
        <ReplacementCarDeliveryForm
          open={!!completionFormState}
          onOpenChange={(open) => {
            if (!open) {
              setCompletionFormState(null);
            }
          }}
          task={completionFormState.task}
          hasExistingAttachments={completionFormState.hasExistingAttachments}
          onSubmit={async () => {
            if (!client || !completionFormState) return;
            const { error: upErr } = await client.rpc('update_task_status', {
              p_task_id: completionFormState.task.id,
              p_status: completionFormState.nextStatus,
              p_driver_id: driverId || undefined,
            });
            if (upErr) {
              const errorMessage = upErr.message || '';
              if (errorMessage.includes('INVALID_STATUS_FLOW')) {
                toastError(
                  'המשימה חייבת להיות בסטטוס "בביצוע" לפני שניתן להשלים אותה',
                  5000
                );
              } else {
                toastError('שגיאה בעדכון סטטוס המשימה');
              }
              throw upErr;
            }
            setRemoteTasks((prev) =>
              prev.map((t) =>
                t.id === completionFormState.task.id
                  ? { ...t, status: completionFormState.nextStatus }
                  : t
              )
            );
            toastSuccess('המשימה בוצעה בהצלחה');
          }}
        />
      ) : null}

      {/* Completion popup for Test Execution */}
      {testCompletionState ? (
        <TestCompletionPopup
          open={!!testCompletionState}
          onOpenChange={(open) => {
            if (!open) {
              setTestCompletionState(null);
            }
          }}
          task={testCompletionState.task}
          onSkip={async () => {
            if (!client || !testCompletionState) return;
            const { error: upErr } = await client.rpc('update_task_status', {
              p_task_id: testCompletionState.task.id,
              p_status: testCompletionState.nextStatus,
              p_driver_id: driverId || undefined,
            });
            if (upErr) {
              console.error(upErr);
              const errorMessage = upErr.message || '';
              if (errorMessage.includes('INVALID_STATUS_FLOW')) {
                toastError(
                  'המשימה חייבת להיות בסטטוס "בביצוע" לפני שניתן להשלים אותה',
                  5000
                );
              } else {
                toastError('שגיאה בעדכון סטטוס המשימה');
              }
              return;
            }
            setRemoteTasks((prev) =>
              prev.map((t) =>
                t.id === testCompletionState.task.id
                  ? { ...t, status: testCompletionState.nextStatus }
                  : t
              )
            );
            toastSuccess('המשימה בוצעה בהצלחה');
          }}
          onSubmit={async (data) => {
            if (!client || !testCompletionState) return;
            const { error: upErr } = await client.rpc('update_task_status', {
              p_task_id: testCompletionState.task.id,
              p_status: testCompletionState.nextStatus,
              p_driver_id: driverId || undefined,
              p_details: data.details,
              p_advisor_name: data.advisorName,
            });
            if (upErr) {
              const errorMessage = upErr.message || '';
              if (errorMessage.includes('INVALID_STATUS_FLOW')) {
                toastError(
                  'המשימה חייבת להיות בסטטוס "בביצוע" לפני שניתן להשלים אותה',
                  5000
                );
              } else {
                toastError('שגיאה בעדכון סטטוס המשימה');
              }
              throw upErr;
            }
            setRemoteTasks((prev) =>
              prev.map((t) =>
                t.id === testCompletionState.task.id
                  ? { ...t, status: testCompletionState.nextStatus }
                  : t
              )
            );
            toastSuccess('הטסט הושלם בהצלחה');
          }}
        />
      ) : null}
    </div>
  );
}

// Re-export helpers for testing
export const __internal = { intersectsToday, isOverdue };
