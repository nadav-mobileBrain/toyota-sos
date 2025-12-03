import { createServerClient } from '@/lib/auth';
import type { SupabaseClient } from '@supabase/supabase-js';

export type IsoDateString = string; // 'YYYY-MM-DDTHH:mm:ssZ'

export interface DateRange {
  start: IsoDateString;
  end: IsoDateString;
  timezone?: string;
}

export interface CreatedCompletedPoint {
  date: string; // YYYY-MM-DD (local to timezone if provided)
  created: number;
  completed: number;
}

export interface OverdueByDriverPoint {
  driver_id: string;
  driver_name: string;
  overdue: number;
}

export interface OnTimeLateCount {
  onTime: number;
  late: number;
}

export interface FunnelStep {
  step: 'assigned' | 'started' | 'completed';
  count: number;
}

export interface DashboardMetricsSummary {
  scheduledTasks: number;
  completedTasks: number;
  completedLate: number;
  completedOnTime: number;
  pendingTasks: number;
  inProgressTasks: number;
  cancelledTasks: number;
  slaViolations: number;
  driverUtilizationPct: number;
}

export interface DashboardDatasets {
  createdCompletedSeries: CreatedCompletedPoint[];
  overdueByDriver: OverdueByDriverPoint[];
  onTimeVsLate: OnTimeLateCount;
  funnel: FunnelStep[];
}

export interface DashboardData {
  summary: DashboardMetricsSummary;
  datasets: DashboardDatasets;
}

// Simple in-memory cache (server-runtime only)
type CacheEntry<T> = { value: T; expiresAt: number };
const FIVE_MINUTES_MS = 5 * 60 * 1000;
const THIRTY_SECONDS_MS = 30 * 1000; // Shorter TTL for recent data
const cache = new Map<string, CacheEntry<unknown>>();

function makeKey(kind: string, range: DateRange) {
  return `${kind}:${range.start}:${range.end}:${range.timezone || 'UTC'}`;
}

function isRecentRange(range: DateRange): boolean {
  // Check if the range includes today or is very recent (within last 24 hours)
  const now = new Date();
  const rangeEnd = new Date(range.end);
  const hoursDiff = (now.getTime() - rangeEnd.getTime()) / (1000 * 60 * 60);
  return hoursDiff < 24;
}

function getCached<T>(key: string): T | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    cache.delete(key);
    return null;
  }
  return hit.value as unknown as T;
}

function setCached<T>(key: string, value: T, ttlMs: number = FIVE_MINUTES_MS) {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

// Clear cache for a specific date range pattern
export function clearCacheForRange(range: DateRange) {
  const prefix = `${range.start}:${range.end}:${range.timezone || 'UTC'}`;
  const keysToDelete: string[] = [];
  for (const key of cache.keys()) {
    if (key.includes(prefix)) {
      keysToDelete.push(key);
    }
  }
  keysToDelete.forEach((key) => cache.delete(key));
}

function getClient(client?: SupabaseClient) {
  if (client) return client;
  // Default to server client; callers can pass a cookie-bound server client from page/route
  return createServerClient();
}

// Helpers
function toYMD(dateIso: string): string {
  try {
    const d = new Date(dateIso);
    // Basic Y-M-D; for tz shifts we accept slight inaccuracies in SSR context
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  } catch {
    return dateIso.slice(0, 10);
  }
}

// Metrics

// 1. Scheduled Tasks (was Created)
// Filter: estimated_start in range
export async function getScheduledTasksCount(
  range: DateRange,
  client?: SupabaseClient
): Promise<number> {
  const key = makeKey('scheduledCount', range);
  const cached = getCached<number>(key);
  if (cached !== null) return cached;
  const supa = getClient(client);
  const { count, error } = await supa
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .gte('estimated_start', range.start)
    .lt('estimated_start', range.end);
  const value = error ? 0 : count || 0;
  const ttl = isRecentRange(range) ? THIRTY_SECONDS_MS : FIVE_MINUTES_MS;
  setCached(key, value, ttl);
  return value;
}

// 2. Completed Tasks
// Filter: estimated_start in range AND status = 'הושלמה'
export async function getTasksCompletedCount(
  range: DateRange,
  client?: SupabaseClient
): Promise<number> {
  const key = makeKey('completedScheduledCount', range);
  const cached = getCached<number>(key);
  if (cached !== null) return cached;
  const supa = getClient(client);
  const { count, error } = await supa
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'הושלמה')
    .gte('estimated_start', range.start)
    .lt('estimated_start', range.end);
  const value = error ? 0 : count || 0;
  const ttl = isRecentRange(range) ? THIRTY_SECONDS_MS : FIVE_MINUTES_MS;
  setCached(key, value, ttl);
  return value;
}

// Helper to fetch completion stats for the scheduled cohort
async function getCompletionStats(
  range: DateRange,
  client?: SupabaseClient
): Promise<{ late: number; onTime: number }> {
  const key = makeKey('completionStats', range);
  const cached = getCached<{ late: number; onTime: number }>(key);
  if (cached) return cached;

  const supa = getClient(client);
  const { data, error } = await supa
    .from('tasks')
    .select('id, updated_at, estimated_end')
    .eq('status', 'הושלמה')
    .gte('estimated_start', range.start)
    .lt('estimated_start', range.end)
    .limit(5000);

  if (error || !data) {
    return { late: 0, onTime: 0 };
  }

  let late = 0;
  let onTime = 0;
  for (const row of data) {
    if (!row.estimated_end || !row.updated_at) continue;
    const end = new Date(row.estimated_end).getTime();
    const actual = new Date(row.updated_at).getTime();
    if (actual > end) {
      late++;
    } else {
      onTime++;
    }
  }

  const result = { late, onTime };
  const ttl = isRecentRange(range) ? THIRTY_SECONDS_MS : FIVE_MINUTES_MS;
  setCached(key, result, ttl);
  return result;
}

// 3. Completed Late (Overdue in plan terms, but effectively Late Completion)
export async function getCompletedLateCount(
  range: DateRange,
  client?: SupabaseClient
): Promise<number> {
  const stats = await getCompletionStats(range, client);
  return stats.late;
}

// 4. Completed On Time
export async function getCompletedOnTimeCount(
  range: DateRange,
  client?: SupabaseClient
): Promise<number> {
  const stats = await getCompletionStats(range, client);
  return stats.onTime;
}

// 5. Pending Tasks
export async function getPendingTasksCount(
  range: DateRange,
  client?: SupabaseClient
): Promise<number> {
  const key = makeKey('pendingCount', range);
  const cached = getCached<number>(key);
  if (cached !== null) return cached;

  const supa = getClient(client);
  const { count, error } = await supa
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'בהמתנה')
    .gte('estimated_start', range.start)
    .lt('estimated_start', range.end);

  const value = error ? 0 : count || 0;
  const ttl = isRecentRange(range) ? THIRTY_SECONDS_MS : FIVE_MINUTES_MS;
  setCached(key, value, ttl);
  return value;
}

// 6. In Progress Tasks
export async function getInProgressTasksCount(
  range: DateRange,
  client?: SupabaseClient
): Promise<number> {
  const key = makeKey('inProgressCount', range);
  const cached = getCached<number>(key);
  if (cached !== null) return cached;

  const supa = getClient(client);
  const { count, error } = await supa
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'בעבודה')
    .gte('estimated_start', range.start)
    .lt('estimated_start', range.end);

  const value = error ? 0 : count || 0;
  const ttl = isRecentRange(range) ? THIRTY_SECONDS_MS : FIVE_MINUTES_MS;
  setCached(key, value, ttl);
  return value;
}

// 7. Cancelled Tasks (includes Blocked)
export async function getCancelledTasksCount(
  range: DateRange,
  client?: SupabaseClient
): Promise<number> {
  const key = makeKey('cancelledCount', range);
  const cached = getCached<number>(key);
  if (cached !== null) return cached;

  const supa = getClient(client);
  const { count, error } = await supa
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'חסומה')
    .gte('estimated_start', range.start)
    .lt('estimated_start', range.end);

  const value = error ? 0 : count || 0;
  const ttl = isRecentRange(range) ? THIRTY_SECONDS_MS : FIVE_MINUTES_MS;
  setCached(key, value, ttl);
  return value;
}

// Keeping original getSlaViolations logic for now as it might be used by charts or legacy,
// but dashboard summary uses the new fields.
// Note: This function considers tasks COMPLETED in the range (updated_at), not SCHEDULED.
export async function getSlaViolations(
  range: DateRange,
  client?: SupabaseClient
): Promise<number> {
  const key = makeKey('slaViolations', range);
  const cached = getCached<number>(key);
  if (cached !== null) return cached;
  const supa = getClient(client);
  // SLA violations: tasks completed after their estimated_end deadline
  const { data, error } = await supa
    .from('tasks')
    .select('id, updated_at, estimated_end')
    .eq('status', 'הושלמה')
    .gte('updated_at', range.start)
    .lt('updated_at', range.end)
    .not('estimated_end', 'is', null)
    .limit(2000); // safety
  if (error || !data) {
    setCached(key, 0);
    return 0;
  }
  let violations = 0;
  for (const row of data) {
    if (!row.estimated_end || !row.updated_at) continue;
    // Violation: completed after estimated_end
    if (
      new Date(row.updated_at).getTime() > new Date(row.estimated_end).getTime()
    ) {
      violations++;
    }
  }
  setCached(key, violations);
  return violations;
}

export async function getDriverUtilization(
  range: DateRange,
  client?: SupabaseClient
): Promise<number> {
  const key = makeKey('driverUtilization', range);
  const cached = getCached<number>(key);
  if (cached !== null) return cached;
  const supa = getClient(client);

  // Get all drivers
  const { data: allDrivers, error: driversError } = await supa
    .from('profiles')
    .select('id')
    .eq('role', 'driver')
    .limit(1000);

  if (driversError || !allDrivers || allDrivers.length === 0) {
    setCached(key, 0);
    return 0;
  }

  const totalDrivers = allDrivers.length;

  // Get drivers with active tasks (assigned tasks that are not completed) in the range
  const { data: activeAssignments, error: assignmentsError } = await supa
    .from('task_assignees')
    .select('driver_id, tasks(id, status)')
    .eq('is_lead', true)
    .gte('assigned_at', range.start)
    .lt('assigned_at', range.end)
    .limit(5000);

  if (assignmentsError || !activeAssignments) {
    setCached(key, 0);
    return 0;
  }

  // Count unique drivers with at least one non-completed task
  const driversWithActiveTasks = new Set<string>();

  (activeAssignments as any[]).forEach((row) => {
    const tasks = row.tasks;
    if (!tasks) return;
    const taskArray = Array.isArray(tasks) ? tasks : [tasks];
    const task = taskArray[0];
    if (!task || !task.status) return;
    // Active task: not completed
    if (task.status !== 'הושלמה') {
      driversWithActiveTasks.add(row.driver_id as string);
    }
  });

  const utilizationPct =
    totalDrivers === 0
      ? 0
      : Math.round((driversWithActiveTasks.size / totalDrivers) * 100);

  setCached(key, utilizationPct);
  return utilizationPct;
}

// Datasets
export async function getCreatedCompletedSeries(
  range: DateRange,
  client?: SupabaseClient
): Promise<CreatedCompletedPoint[]> {
  const key = makeKey('seriesCreatedCompleted', range);
  const cached = getCached<CreatedCompletedPoint[]>(key);
  if (cached) return cached;
  const supa = getClient(client);
  const [{ data: createdData }, { data: completedData }] = await Promise.all([
    supa
      .from('tasks')
      .select('id, estimated_start')
      .gte('estimated_start', range.start)
      .lt('estimated_start', range.end)
      .limit(5000),
    supa
      .from('tasks')
      .select('id, updated_at')
      .eq('status', 'הושלמה')
      .gte('updated_at', range.start)
      .lt('updated_at', range.end)
      .limit(5000),
  ]);
  const byDate: Record<string, { created: number; completed: number }> = {};
  (createdData || []).forEach((r) => {
    const d = toYMD(r.estimated_start);
    byDate[d] = byDate[d] || { created: 0, completed: 0 };
    byDate[d].created++;
  });
  (completedData || []).forEach((r) => {
    const d = toYMD(r.updated_at);
    byDate[d] = byDate[d] || { created: 0, completed: 0 };
    byDate[d].completed++;
  });
  const points = Object.keys(byDate)
    .sort()
    .map((d) => ({
      date: d,
      created: byDate[d].created,
      completed: byDate[d].completed,
    }));
  setCached(key, points);
  return points;
}

export async function getOverdueByDriver(
  range: DateRange,
  client?: SupabaseClient
): Promise<OverdueByDriverPoint[]> {
  const key = makeKey('overdueByDriver', range);
  const cached = getCached<OverdueByDriverPoint[]>(key);
  if (cached) return cached;
  const supa = getClient(client);
  // Join task_assignees (lead) to profiles to get driver names
  const { data, error } = await supa
    .from('task_assignees')
    .select(
      'driver_id, is_lead, tasks(id, status, estimated_end), profiles:driver_id(name)'
    )
    .eq('is_lead', true)
    .limit(5000);
  if (error || !data) {
    setCached(key, []);
    return [];
  }
  const counts = new Map<string, { name: string; count: number }>();
  (data as any[]).forEach((row) => {
    const tasks = row.tasks;
    if (!tasks) return;
    // Handle both array and single object cases from Supabase join
    const taskArray = Array.isArray(tasks) ? tasks : [tasks];
    const task = taskArray[0];
    if (!task || !task.status) return;
    const deadlineTime = task.estimated_end
      ? new Date(task.estimated_end).getTime()
      : null;
    const overdue =
      task.status !== 'הושלמה' &&
      deadlineTime !== null &&
      deadlineTime >= new Date(range.start).getTime() &&
      deadlineTime < new Date(range.end).getTime();
    if (!overdue) return;
    const id = row.driver_id as string;
    const profiles = row.profiles;
    const profileArray = Array.isArray(profiles)
      ? profiles
      : profiles
      ? [profiles]
      : [];
    const name = (profileArray[0]?.name as string) || '—';
    const prev = counts.get(id) || { name, count: 0 };
    prev.count += 1;
    counts.set(id, prev);
  });
  const points: OverdueByDriverPoint[] = Array.from(counts.entries()).map(
    ([driver_id, v]) => ({
      driver_id,
      driver_name: v.name,
      overdue: v.count,
    })
  );
  setCached(key, points);
  return points;
}

export async function getOnTimeVsLate(
  range: DateRange,
  client?: SupabaseClient
): Promise<OnTimeLateCount> {
  const key = makeKey('onTimeVsLate', range);
  const cached = getCached<OnTimeLateCount>(key);
  if (cached) return cached;
  const supa = getClient(client);
  const { data, error } = await supa
    .from('tasks')
    .select('id, updated_at, estimated_end, status')
    .eq('status', 'הושלמה')
    .gte('updated_at', range.start)
    .lt('updated_at', range.end)
    .limit(5000);
  if (error || !data) {
    const v = { onTime: 0, late: 0 };
    setCached(key, v);
    return v;
  }
  let onTime = 0;
  let late = 0;
  data.forEach((t) => {
    if (!t.estimated_end || !t.updated_at) return;
    if (new Date(t.updated_at).getTime() <= new Date(t.estimated_end).getTime())
      onTime++;
    else late++;
  });
  const v = { onTime, late };
  setCached(key, v);
  return v;
}

export async function getFunnel(
  range: DateRange,
  client?: SupabaseClient
): Promise<FunnelStep[]> {
  const key = makeKey('funnel', range);
  const cached = getCached<FunnelStep[]>(key);
  if (cached) return cached;
  const supa = getClient(client);
  // Approximations based on available fields:
  // assigned: any task with at least one assignee in range (using created_at window as proxy)
  const [{ data: assigned }, { data: started }, { data: completed }] =
    await Promise.all([
      supa
        .from('task_assignees')
        .select('id, assigned_at')
        .gte('assigned_at', range.start)
        .lt('assigned_at', range.end)
        .limit(5000),
      // started: tasks moved out of pending/in_progress? We proxy by updated_at in range and status in ('בעבודה','הושלמה')
      supa
        .from('tasks')
        .select('id, status, updated_at')
        .in('status', ['בעבודה', 'הושלמה'])
        .gte('updated_at', range.start)
        .lt('updated_at', range.end)
        .limit(5000),
      // completed: status הושלמה updated in range
      supa
        .from('tasks')
        .select('id, updated_at')
        .eq('status', 'הושלמה')
        .gte('updated_at', range.start)
        .lt('updated_at', range.end)
        .limit(5000),
    ]);
  const steps: FunnelStep[] = [
    { step: 'assigned', count: (assigned || []).length },
    { step: 'started', count: (started || []).length },
    { step: 'completed', count: (completed || []).length },
  ];
  setCached(key, steps);
  return steps;
}

export async function fetchDashboardData(
  range: DateRange,
  client?: SupabaseClient
): Promise<DashboardData> {
  const [
    scheduledTasks,
    completedTasks,
    completedLate,
    completedOnTime,
    pendingTasks,
    inProgressTasks,
    cancelledTasks,
    slaViolations,
    driverUtilizationPct,
    createdCompletedSeries,
    overdueByDriver,
    onTimeVsLate,
    funnel,
  ] = await Promise.all([
    getScheduledTasksCount(range, client),
    getTasksCompletedCount(range, client),
    getCompletedLateCount(range, client),
    getCompletedOnTimeCount(range, client),
    getPendingTasksCount(range, client),
    getInProgressTasksCount(range, client),
    getCancelledTasksCount(range, client),
    getSlaViolations(range, client),
    getDriverUtilization(range, client),
    getCreatedCompletedSeries(range, client),
    getOverdueByDriver(range, client),
    getOnTimeVsLate(range, client),
    getFunnel(range, client),
  ]);

  return {
    summary: {
      scheduledTasks,
      completedTasks,
      completedLate,
      completedOnTime,
      pendingTasks,
      inProgressTasks,
      cancelledTasks,
      slaViolations,
      driverUtilizationPct,
    },
    datasets: {
      createdCompletedSeries,
      overdueByDriver,
      onTimeVsLate,
      funnel,
    },
  };
}
