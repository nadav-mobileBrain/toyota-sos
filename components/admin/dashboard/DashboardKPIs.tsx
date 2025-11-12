'use client';

import React from 'react';
import { PeriodProvider, usePeriod } from './PeriodContext';
import { PeriodFilter } from './PeriodFilter';
import { KpiCard } from './KpiCard';
import { toCsv, downloadCsv, makeCsvFilename } from '@/utils/csv';
// fetch from server API to avoid RLS issues and ensure service-role-backed metrics

function KPIsGrid() {
  const { range } = usePeriod();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [data, setData] = React.useState<Awaited<ReturnType<typeof fetchDashboardData>> | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const u = new URL('/api/admin/dashboard/summary', window.location.origin);
        u.searchParams.set('from', range.start);
        u.searchParams.set('to', range.end);
        if (range.timezone) u.searchParams.set('tz', range.timezone);
        const resp = await fetch(u.toString());
        if (!resp.ok) throw new Error(await resp.text());
        const json = await resp.json();
        if (!json?.ok) throw new Error(json?.error || 'failed');
        if (!cancelled) setData(json.data);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [range.start, range.end, range.timezone]);

  const summary = data?.summary;
  const datasets = data?.datasets;

  const exportCreatedCompleted = React.useCallback(() => {
    if (!datasets) return;
    const rows = datasets.createdCompletedSeries.map((p) => ({ date: p.date, created: p.created, completed: p.completed }));
    const csv = toCsv(rows, ['date', 'created', 'completed']);
    downloadCsv(makeCsvFilename('dashboard_created_completed', range.timezone), csv);
  }, [datasets, range.timezone]);

  const exportAllCsv = React.useCallback(() => {
    if (!data) return;
    const secs: string[] = [];
    const bom = '\uFEFF';
    // Summary section
    const summaryRows = [
      { metric: 'tasksCreated', value: data.summary.tasksCreated },
      { metric: 'tasksCompleted', value: data.summary.tasksCompleted },
      { metric: 'overdueCount', value: data.summary.overdueCount },
      { metric: 'onTimeRatePct', value: data.summary.onTimeRatePct },
    ];
    const summaryCsv = (toCsv(summaryRows, ['metric', 'value']) || '').slice(1); // strip BOM, we add once at the end
    secs.push('Section,Summary');
    secs.push(summaryCsv);

    // Created/Completed time series
    const seriesRows = data.datasets.createdCompletedSeries.map((p) => ({
      date: p.date,
      created: p.created,
      completed: p.completed,
    }));
    const seriesCsv = (toCsv(seriesRows, ['date', 'created', 'completed']) || '').slice(1);
    secs.push('');
    secs.push('Section,CreatedCompletedSeries');
    secs.push(seriesCsv);

    // Overdue by driver
    const overdueRows = data.datasets.overdueByDriver.map((p) => ({
      driver_id: p.driver_id,
      driver_name: p.driver_name,
      overdue: p.overdue,
    }));
    const overdueCsv = (toCsv(overdueRows, ['driver_id', 'driver_name', 'overdue']) || '').slice(1);
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
    const funnelRows = data.datasets.funnel.map((p) => ({ step: p.step, count: p.count }));
    const funnelCsv = (toCsv(funnelRows, ['step', 'count']) || '').slice(1);
    secs.push('');
    secs.push('Section,Funnel');
    secs.push(funnelCsv);

    const joined = bom + secs.join('\n');
    downloadCsv(makeCsvFilename('dashboard_all', range.timezone), joined);
  }, [data, range.timezone]);
  const exportOverdueByDriver = React.useCallback(() => {
    if (!datasets) return;
    const rows = datasets.overdueByDriver.map((p) => ({ driver_id: p.driver_id, driver_name: p.driver_name, overdue: p.overdue }));
    const csv = toCsv(rows, ['driver_id', 'driver_name', 'overdue']);
    downloadCsv(makeCsvFilename('dashboard_overdue_by_driver', range.timezone), csv);
  }, [datasets, range.timezone]);

  const exportOnTimeVsLate = React.useCallback(() => {
    if (!datasets) return;
    const rows = [
      { label: 'onTime', count: datasets.onTimeVsLate.onTime },
      { label: 'late', count: datasets.onTimeVsLate.late },
    ];
    const csv = toCsv(rows, ['label', 'count']);
    downloadCsv(makeCsvFilename('dashboard_on_time_vs_late', range.timezone), csv);
  }, [datasets, range.timezone]);

  const exportFunnel = React.useCallback(() => {
    if (!datasets) return;
    const rows = datasets.funnel.map((p) => ({ step: p.step, count: p.count }));
    const csv = toCsv(rows, ['step', 'count']);
    downloadCsv(makeCsvFilename('dashboard_funnel', range.timezone), csv);
  }, [datasets, range.timezone]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          className="rounded border border-gray-300 bg-white px-3 py-1 text-sm font-semibold text-toyota-primary hover:bg-gray-50"
          onClick={exportAllCsv}
        >
          ייצוא CSV כולל
        </button>
        <div className="ml-auto">
          <PeriodFilter />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          title="משימות שנוצרו"
          value={summary?.tasksCreated ?? 0}
          loading={loading}
          error={error}
          actionArea={
            <button className="text-xs text-toyota-primary hover:underline" onClick={exportCreatedCompleted}>
              CSV
            </button>
          }
        />
        <KpiCard
          title="משימות שהושלמו"
          value={summary?.tasksCompleted ?? 0}
          loading={loading}
          error={error}
          actionArea={
            <button className="text-xs text-toyota-primary hover:underline" onClick={exportCreatedCompleted}>
              CSV
            </button>
          }
        />
        <KpiCard
          title="באיחור"
          value={summary?.overdueCount ?? 0}
          loading={loading}
          error={error}
          actionArea={
            <button className="text-xs text-toyota-primary hover:underline" onClick={exportOverdueByDriver}>
              CSV
            </button>
          }
        />
        <KpiCard
          title="השלמה בזמן"
          value={`${summary?.onTimeRatePct ?? 0}%`}
          loading={loading}
          error={error}
          secondary="אחוז משימות שהושלמו עד היעד"
          actionArea={
            <button className="text-xs text-toyota-primary hover:underline" onClick={exportOnTimeVsLate}>
              CSV
            </button>
          }
        />
        {/* Placeholders for the rest; will be expanded in 8.3 */}
        <KpiCard title="זמן הקצאה→התחלה (ממוצע)" value="—" loading={loading} error={error} actionArea={<button className="text-xs text-gray-400">CSV</button>} />
        <KpiCard title="זמן התחלה→סיום (ממוצע)" value="—" loading={loading} error={error} actionArea={<button className="text-xs text-gray-400">CSV</button>} />
        <KpiCard title="ניצולת נהגים" value="—" loading={loading} error={error} actionArea={<button className="text-xs text-gray-400">CSV</button>} />
        <KpiCard title="ביטולים/השמות מחדש" value="—" loading={loading} error={error} actionArea={<button className="text-xs text-gray-400">CSV</button>} />
        <KpiCard
          title="הפרות SLA"
          value="—"
          loading={loading}
          error={error}
          actionArea={
            <button className="text-xs text-toyota-primary hover:underline" onClick={exportFunnel}>
              CSV
            </button>
          }
        />
      </div>
    </div>
  );
}

export function DashboardKPIs() {
  return (
    <PeriodProvider>
      <KPIsGrid />
    </PeriodProvider>
  );
}


