'use client';

import React from 'react';
import { usePeriod } from './PeriodContext';
import { KpiCard } from './KpiCard';
import { toCsv, downloadCsv, makeCsvFilename } from '@/utils/csv';
// fetch from server API to avoid RLS issues and ensure service-role-backed metrics
import dynamic from 'next/dynamic';
import { useConnectivity } from '@/components/ConnectivityProvider';
import type {
  DashboardData,
  CreatedCompletedPoint,
  OverdueByDriverPoint,
  FunnelStep,
} from '@/lib/dashboard/queries';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { DownloadIcon } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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
  const [data, setData] = React.useState<DashboardData | null>(null);
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
  const [breakdownView, setBreakdownView] = React.useState<'late' | 'on_time'>(
    'on_time'
  );

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

  const exportAllCsv = React.useCallback(() => {
    if (!data) return;
    const secs: string[] = [];
    const bom = '\uFEFF';
    // Summary section
    const summaryRows = [
      { metric: 'scheduledTasks', value: data.summary.scheduledTasks },
      { metric: 'completedTasks', value: data.summary.completedTasks },
      { metric: 'completedLate', value: data.summary.completedLate },
      { metric: 'completedOnTime', value: data.summary.completedOnTime },
      { metric: 'slaViolations', value: data.summary.slaViolations },
      {
        metric: 'driverUtilizationPct',
        value: data.summary.driverUtilizationPct,
      },
    ];
    const summaryCsv = (toCsv(summaryRows, ['metric', 'value']) || '').slice(1); // strip BOM, we add once at the end
    secs.push('Section,Summary');
    secs.push(summaryCsv);

    // Created/Completed time series
    const seriesRows = data.datasets.createdCompletedSeries.map(
      (p: CreatedCompletedPoint) => ({
        date: p.date,
        created: p.created,
        completed: p.completed,
      })
    );
    const seriesCsv = (
      toCsv(seriesRows, ['date', 'created', 'completed']) || ''
    ).slice(1);
    secs.push('');
    secs.push('Section,CreatedCompletedSeries');
    secs.push(seriesCsv);

    // Overdue by driver
    const overdueRows = data.datasets.overdueByDriver.map(
      (p: OverdueByDriverPoint) => ({
        driver_id: p.driver_id,
        driver_name: p.driver_name,
        overdue: p.overdue,
      })
    );
    const overdueCsv = (
      toCsv(overdueRows, ['driver_id', 'driver_name', 'overdue']) || ''
    ).slice(1);
    secs.push('');
    secs.push('Section,OverdueByDriver');
    secs.push(overdueCsv);

    // OnTime vs Late
    const otRows = [
      { label: 'onTime', count: data.datasets.onTimeVsLate.onTime },
      { label: 'late', count: data.datasets.onTimeVsLate.late },
    ];
    const otCsv = (toCsv(otRows, ['label', 'count']) || '').slice(1);
    secs.push('');
    secs.push('Section,OnTimeVsLate');
    secs.push(otCsv);

    // Funnel
    const funnelRows = data.datasets.funnel.map((p: FunnelStep) => ({
      step: p.step,
      count: p.count,
    }));
    const funnelCsv = (toCsv(funnelRows, ['step', 'count']) || '').slice(1);
    secs.push('');
    secs.push('Section,Funnel');
    secs.push(funnelCsv);

    const joined = bom + secs.join('\n');
    downloadCsv(makeCsvFilename('dashboard_all', range.timezone), joined);
  }, [data, range.timezone]);

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
  const late = summary?.completedLate ?? 0;
  const onTime = summary?.completedOnTime ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          className="flex items-center gap-2 rounded border border-gray-300 bg-primary/10 px-3 py-1 text-sm font-semibold text-primary hover:bg-gray-50"
          onClick={exportAllCsv}
        >
          <DownloadIcon className="w-4 h-4 mr-2" />
          ייצוא CSV
        </button>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="משימות מתוכננות"
          value={scheduled}
          percentage={scheduled > 0 ? 100 : 0}
          loading={loading}
          error={error}
          actionArea={
            <div className="flex items-center gap-2">
              <button
                className="text-xs text-gray-600 hover:underline"
                onClick={() => openDrilldown('scheduled', 'משימות מתוכננות')}
              >
                פרטים
              </button>
            </div>
          }
        />

        <div className="flex flex-col gap-2">
          <KpiCard
            title="משימות שבוצעו"
            value={completed}
            percentage={getPct(completed, scheduled)}
            loading={loading}
            error={error}
            actionArea={
              <div className="flex items-center gap-2">
                <button
                  className="text-xs text-gray-600 hover:underline"
                  onClick={() => openDrilldown('completed', 'משימות שהושלמו')}
                >
                  פרטים
                </button>
              </div>
            }
          />

          {/* Completion Breakdown Sub-section */}
          <KpiCard
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
          />
        </div>

        {/* Row 2 */}
        <div className="grid grid-cols-2 gap-4 md:col-span-2 lg:col-span-2">
          <KpiCard
            title="ממתינות לביצוע"
            value={summary?.pendingTasks ?? 0}
            percentage={getPct(summary?.pendingTasks ?? 0, scheduled)}
            loading={loading}
            error={error}
            actionArea={
              <div className="flex items-center gap-2">
                <button
                  className="text-xs text-gray-600 hover:underline"
                  onClick={() => openDrilldown('pending', 'ממתינות')}
                >
                  פרטים
                </button>
              </div>
            }
          />
          <KpiCard
            title="בביצוע"
            value={summary?.inProgressTasks ?? 0}
            percentage={getPct(summary?.inProgressTasks ?? 0, scheduled)}
            loading={loading}
            error={error}
            actionArea={
              <div className="flex items-center gap-2">
                <button
                  className="text-xs text-gray-600 hover:underline"
                  onClick={() => openDrilldown('in_progress', 'בעבודה')}
                >
                  פרטים
                </button>
              </div>
            }
          />
        </div>

        <KpiCard
          title="חסומות"
          value={summary?.cancelledTasks ?? 0}
          percentage={getPct(summary?.cancelledTasks ?? 0, scheduled)}
          loading={loading}
          error={error}
          actionArea={
            <div className="flex items-center gap-2">
              <button
                className="text-xs text-gray-600 hover:underline"
                onClick={() => openDrilldown('cancelled', 'בוטלו/חסומות')}
              >
                פרטים
              </button>
            </div>
          }
        />

        <KpiCard
          title="ניצולת נהגים"
          value={`${summary?.driverUtilizationPct ?? 0}%`}
          loading={loading}
          error={error}
          secondary="אחוז נהגים עם משימות פעילות"
        />
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
