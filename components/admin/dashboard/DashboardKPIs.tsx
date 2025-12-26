'use client';

import React from 'react';
import { usePeriod } from './PeriodContext';
import { KpiCard } from './KpiCard';
import { cn } from '@/lib/utils';
// fetch from server API to avoid RLS issues and ensure service-role-backed metrics
import dynamic from 'next/dynamic';
import { useConnectivity } from '@/components/ConnectivityProvider';
import type { DashboardDataWithTrends } from '@/lib/dashboard/queries';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { DownloadIcon } from 'lucide-react';
import { exportDashboardCsv } from '@/lib/dashboard/exportDashboardCsv';

// lazy drilldown modal (client-only)
const DrilldownModal = dynamic(
  () => import('./DrilldownModal').then((m) => ({ default: m.DrilldownModal })),
  { ssr: false }
);

function debounce<F extends (...args: unknown[]) => void>(
  fn: F,
  delay: number
) {
  let t: ReturnType<typeof setTimeout> | undefined;
  return (...args: Parameters<F>) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}

export function DashboardKPIs() {
  const { range } = usePeriod();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [data, setData] = React.useState<DashboardDataWithTrends | null>(null);
  const { isOnline } = useConnectivity();
  // drill-down modal state
  const [ddOpen, setDdOpen] = React.useState(false);
  const [ddTitle, setDdTitle] = React.useState<string>('');
  const [ddRows, setDdRows] = React.useState<
    Array<{
      id: string;
      title: string;
      type: string;
      status: string;
      priority: string;
      created_at: string;
      updated_at: string;
      estimated_end: string | null;
      driver_name: string | null;
    }>
  >([]);
  const [ddLoading, setDdLoading] = React.useState(false);
  const [ddError, setDdError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        if (!isOnline) {
          if (!cancelled) {
            setError('offline');
            setLoading(false);
          }
          return;
        }
        const u = new URL(
          '/api/admin/dashboard/summary',
          window.location.origin
        );
        u.searchParams.set('from', range.start);
        u.searchParams.set('to', range.end);
        u.searchParams.set('trends', 'true');
        if (range.timezone) u.searchParams.set('tz', range.timezone);
        const resp = await fetch(u.toString());
        if (!resp.ok) throw new Error(await resp.text());
        const json = await resp.json();
        if (!json?.ok) throw new Error(json?.error || 'failed');
        if (!cancelled) setData(json.data);
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [range.start, range.end, range.timezone, isOnline]);

  // Realtime auto-refresh for tasks changes
  React.useEffect(() => {
    let cancelled = false;
    let supa: SupabaseClient | undefined;
    let channel: RealtimeChannel | undefined;
    const doRefetch = debounce(async () => {
      if (cancelled) return;
      if (!isOnline) return;
      try {
        const u = new URL(
          '/api/admin/dashboard/summary',
          window.location.origin
        );
        u.searchParams.set('from', range.start);
        u.searchParams.set('to', range.end);
        u.searchParams.set('trends', 'true');
        if (range.timezone) u.searchParams.set('tz', range.timezone);
        // Add cache-busting timestamp for realtime updates
        u.searchParams.set('_t', Date.now().toString());
        const resp = await fetch(u.toString());
        if (!resp.ok) return;
        const json = await resp.json();
        if (json?.ok && !cancelled) setData(json.data);
      } catch {
        // ignore
      }
    }, 500);
    (async () => {
      try {
        const { createBrowserClient } = await import('@/lib/auth');
        supa = createBrowserClient();
        channel = supa
          .channel('realtime:dashboard-kpis')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'tasks' },
            () => doRefetch()
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'task_assignees' },
            () => doRefetch()
          )
          .subscribe();
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
      try {
        if (channel && supa) supa.removeChannel(channel);
      } catch {
        // ignore
      }
    };
  }, [range.start, range.end, range.timezone, isOnline]);

  const summary = data?.summary;

  const exportAllCsv = React.useCallback(async () => {
    if (!data) return;
    await exportDashboardCsv(data, range);
  }, [data, range]);

  const openDrilldown = React.useCallback(
    async (
      metric:
        | 'scheduled'
        | 'completed'
        | 'late'
        | 'on_time'
        | 'pending'
        | 'in_progress'
        | 'cancelled',
      title: string
    ) => {
      setDdOpen(true);
      setDdTitle(title);
      setDdLoading(true);
      setDdError(null);
      setDdRows([]);
      try {
        const u = new URL(
          '/api/admin/dashboard/details',
          window.location.origin
        );
        u.searchParams.set('metric', metric);
        u.searchParams.set('from', range.start);
        u.searchParams.set('to', range.end);
        if (range.timezone) u.searchParams.set('tz', range.timezone);
        const resp = await fetch(u.toString());
        if (!resp.ok) throw new Error(await resp.text());
        const json = await resp.json();
        if (!json?.ok) throw new Error(json?.error || 'failed');
        setDdRows(json.rows || []);
      } catch (e: unknown) {
        setDdError(e instanceof Error ? e.message : 'failed');
      } finally {
        setDdLoading(false);
      }
    },
    [range.start, range.end, range.timezone]
  );

  // Helper for percentage
  const getPct = (num: number | undefined, total: number | undefined) => {
    if (!num || !total || total === 0) return 0;
    return Math.round((num / total) * 100);
  };

  const scheduled = summary?.scheduledTasks ?? 0;
  const completed = summary?.completedTasks ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-toyota-red rounded-full animate-pulse-glow" />
          <span className="text-sm font-medium text-slate-600">
            נתונים בזמן אמת
          </span>
        </div>
        <button
          className="group flex items-center gap-2 rounded-lg border border-slate-200/60 bg-linear-to-r from-green-600 to-green-500 px-4 py-2 text-sm font-semibold text-primary hover:from-green-400/20 hover:to-green-500/10 transition-all duration-300 shadow-sm hover:shadow-md hover:scale-105 interactive-lift"
          onClick={exportAllCsv}
        >
          <DownloadIcon className="w-4 h-4 group-hover:scale-110 transition-transform duration-200" />
          <span className="hidden sm:inline">ייצוא CSV</span>
          <span className="sm:hidden">ייצוא</span>
        </button>
      </div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative group">
          <div className="absolute -inset-1 bg-linear-to-r from-blue-600/20 to-blue-400/20 rounded-lg blur opacity-0 group-hover:opacity-100 transition-all duration-300 animate-gradient-shift" />
          <KpiCard
            title="משימות מתוכננות"
            value={scheduled}
            percentage={scheduled > 0 ? 100 : 0}
            trend={data?.summary.trends?.scheduledTasks}
            isPositiveGood={true}
            loading={loading}
            error={error}
            actionArea={
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full group-hover:scale-125 transition-transform duration-200" />
                <button
                  className="text-xs text-slate-600 hover:text-blue-600 hover:underline transition-colors duration-200 font-medium"
                  onClick={() => openDrilldown('scheduled', 'משימות מתוכננות')}
                >
                  פרטים
                </button>
              </div>
            }
          />
        </div>

        <div className="flex flex-col gap-6">
          <div className="relative group">
            <div
              className={cn(
                'absolute -inset-1 rounded-lg blur opacity-0 group-hover:opacity-100 transition-all duration-300',
                getPct(completed, scheduled) >= 80
                  ? 'bg-linear-to-r from-green-600/20 to-emerald-400/20'
                  : getPct(completed, scheduled) >= 50
                  ? 'bg-linear-to-r from-yellow-600/20 to-amber-400/20'
                  : 'bg-linear-to-r from-red-600/20 to-red-400/20'
              )}
            />
            <KpiCard
              title="משימות שבוצעו"
              value={completed}
              percentage={getPct(completed, scheduled)}
              trend={data?.summary.trends?.completedTasks}
              isPositiveGood={true}
              loading={loading}
              error={error}
              actionArea={
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      'w-1.5 h-1.5 rounded-full group-hover:scale-125 transition-transform duration-200',
                      getPct(completed, scheduled) >= 80
                        ? 'bg-green-500'
                        : getPct(completed, scheduled) >= 50
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                    )}
                  />
                  <button
                    className="text-xs text-slate-600 hover:text-green-600 hover:underline transition-colors duration-200 font-medium"
                    onClick={() => openDrilldown('completed', 'משימות שהושלמו')}
                  >
                    פרטים
                  </button>
                </div>
              }
            />
          </div>

          {/* Completion Breakdown Sub-section */}
          {/* <KpiCard
            title={breakdownView === 'late' ? 'הושלמו באיחור' : 'הושלמו בזמן'}
            value={breakdownView === 'late' ? late : onTime}
            percentage={getPct(
              breakdownView === 'late' ? late : onTime,
              completed
            )}
            percentageLabel="מסך שהושלמו"
            variant="secondary"
            loading={loading}
            error={error}
            actionArea={
              <div className="flex items-center gap-2">
                <Select
                  value={breakdownView}
                  onValueChange={(v) =>
                    setBreakdownView(v as 'late' | 'on_time')
                  }
                >
                  <SelectTrigger className="h-7 w-[100px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="late">באיחור</SelectItem>
                    <SelectItem value="on_time">בזמן</SelectItem>
                  </SelectContent>
                </Select>
                <button
                  className="text-xs text-gray-600 hover:underline"
                  onClick={() =>
                    openDrilldown(
                      breakdownView,
                      breakdownView === 'late' ? 'הושלמו באיחור' : 'הושלמו בזמן'
                    )
                  }
                >
                  פרטים
                </button>
              </div>
            }
          /> */}
        </div>

        {/* Row 2 */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:col-span-2 lg:col-span-2">
          <div className="relative group">
            <div className="absolute -inset-1 bg-linear-to-r from-orange-600/20 to-orange-400/20 rounded-lg blur opacity-0 group-hover:opacity-100 transition-all duration-300" />
            <KpiCard
              title="ממתינות לביצוע"
              value={summary?.pendingTasks ?? 0}
              percentage={getPct(summary?.pendingTasks ?? 0, scheduled)}
              trend={data?.summary.trends?.pendingTasks}
              isPositiveGood={false}
              loading={loading}
              error={error}
              actionArea={
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-orange-500 rounded-full group-hover:scale-125 transition-transform duration-200 animate-pulse" />
                  <button
                    className="text-xs text-slate-600 hover:text-orange-600 hover:underline transition-colors duration-200 font-medium"
                    onClick={() => openDrilldown('pending', 'ממתינות')}
                  >
                    פרטים
                  </button>
                </div>
              }
            />
          </div>
          <div className="relative group">
            <div className="absolute -inset-1 bg-linear-to-r from-blue-600/20 to-blue-400/20 rounded-lg blur opacity-0 group-hover:opacity-100 transition-all duration-300" />
            <KpiCard
              title="בביצוע"
              value={summary?.inProgressTasks ?? 0}
              percentage={getPct(summary?.inProgressTasks ?? 0, scheduled)}
              trend={data?.summary.trends?.inProgressTasks}
              isPositiveGood={true}
              loading={loading}
              error={error}
              actionArea={
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full group-hover:scale-125 transition-transform duration-200 animate-pulse" />
                  <button
                    className="text-xs text-slate-600 hover:text-blue-600 hover:underline transition-colors duration-200 font-medium"
                    onClick={() => openDrilldown('in_progress', 'בעבודה')}
                  >
                    פרטים
                  </button>
                </div>
              }
            />
          </div>
        </div>

        <div className="relative group">
          <div className="absolute -inset-1 bg-linear-to-r from-red-600/20 to-red-400/20 rounded-lg blur opacity-0 group-hover:opacity-100 transition-all duration-300" />
          <KpiCard
            title="חסומות"
            value={summary?.cancelledTasks ?? 0}
            percentage={getPct(summary?.cancelledTasks ?? 0, scheduled)}
            trend={data?.summary.trends?.cancelledTasks}
            isPositiveGood={false}
            loading={loading}
            error={error}
            actionArea={
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-red-500 rounded-full group-hover:scale-125 transition-transform duration-200" />
                <button
                  className="text-xs text-slate-600 hover:text-red-600 hover:underline transition-colors duration-200 font-medium"
                  onClick={() => openDrilldown('cancelled', 'בוטלו/חסומות')}
                >
                  פרטים
                </button>
              </div>
            }
          />
        </div>

        <div className="relative group">
          <div
            className={cn(
              'absolute -inset-1 rounded-lg blur opacity-0 group-hover:opacity-100 transition-all duration-300',
              (summary?.driverUtilizationPct ?? 0) >= 80
                ? 'bg-linear-to-r from-green-600/20 to-emerald-400/20'
                : (summary?.driverUtilizationPct ?? 0) >= 50
                ? 'bg-linear-to-r from-yellow-600/20 to-amber-400/20'
                : 'bg-linear-to-r from-red-600/20 to-red-400/20'
            )}
          />
          <KpiCard
            title="ניצולת נהגים"
            value={`${summary?.driverUtilizationPct ?? 0}%`}
            trend={data?.summary.trends?.driverUtilizationPct}
            isPositiveGood={true}
            loading={loading}
            error={error}
            secondary="אחוז נהגים עם משימות פעילות"
            actionArea={
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    'w-1.5 h-1.5 rounded-full group-hover:scale-125 transition-transform duration-200',
                    (summary?.driverUtilizationPct ?? 0) >= 80
                      ? 'bg-green-500'
                      : (summary?.driverUtilizationPct ?? 0) >= 50
                      ? 'bg-yellow-500'
                      : 'bg-red-500'
                  )}
                />
              </div>
            }
          />
        </div>

        <div className="relative group">
          <div className="absolute -inset-1 bg-linear-to-r from-emerald-600/20 to-green-400/20 rounded-lg blur opacity-0 group-hover:opacity-100 transition-all duration-300" />
          <KpiCard
            title="נהגים פעילים"
            value={summary?.activeDrivers ?? 0}
            trend={data?.summary.trends?.activeDrivers}
            isPositiveGood={true}
            loading={loading}
            error={error}
            secondary="נהגים שקיבלו משימות בתקופה"
            actionArea={
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full group-hover:scale-125 transition-transform duration-200" />
              </div>
            }
          />
        </div>
      </div>
      <DrilldownModal
        open={ddOpen}
        title={ddTitle}
        rows={ddRows}
        loading={ddLoading}
        error={ddError}
        onClose={() => setDdOpen(false)}
      />
    </div>
  );
}
