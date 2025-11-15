'use client';

import React from 'react';
import {
  Line,
  LineChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  ReferenceLine,
} from 'recharts';
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart';
import { usePeriod } from '@/components/admin/dashboard/PeriodContext';

interface WeeklyPoint {
  date: string;
  completed: number;
  notCompleted: number;
  overdue: number;
}

const weeklyChartConfig = {
  completed: { label: 'הושלמו', color: '#16a34a' }, // green-600
  notCompleted: { label: 'לא הושלמו', color: '#f97316' }, // orange-500
  overdue: { label: 'באיחור', color: '#ef4444' }, // red-500
} as const;

function useWeeklyTrends() {
  const { range } = usePeriod();
  const [data, setData] = React.useState<WeeklyPoint[] | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const u = new URL(
          '/api/tasks/analytics/weekly',
          window.location.origin
        );
        u.searchParams.set('from', range.start);
        u.searchParams.set('to', range.end);
        if (range.timezone) u.searchParams.set('tz', range.timezone);
        const resp = await fetch(u.toString());
        if (!resp.ok) throw new Error(await resp.text());
        const json = await resp.json();
        if (!json?.ok) throw new Error(json?.error || 'failed');
        if (!cancelled) setData(json.points || []);
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'failed');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [range.start, range.end, range.timezone]);

  return { data, loading, error };
}

function WeeklyTrendsChart() {
  const { data, loading, error } = useWeeklyTrends();

  if (loading) {
    return (
      <div className="mt-4 h-64 animate-pulse rounded-md bg-gray-100" />
    );
  }

  if (error) {
    return (
      <div className="mt-4 h-64 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
        שגיאה בטעינת נתוני המגמה השבועית: {error}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="mt-4 flex h-64 items-center justify-center rounded-md border border-dashed border-gray-200 text-xs text-gray-500">
        אין נתונים להצגה עבור התקופה שנבחרה.
      </div>
    );
  }

  return (
    <div className="mt-4 h-64">
      <ChartContainer
        config={weeklyChartConfig}
        className="h-full w-full"
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 10, right: 16, left: 0, bottom: 0 }}
          >
            <CartesianGrid stroke="#e5e7eb" strokeDasharray="4 4" />
            <XAxis
              dataKey="date"
              tickFormatter={(value: string) =>
                new Date(value).toLocaleDateString('he-IL', {
                  weekday: 'short',
                })
              }
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tick={{ fontSize: 10, fill: '#6b7280' }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tick={{ fontSize: 10, fill: '#6b7280' }}
              allowDecimals={false}
            />
            <Tooltip
              cursor={{ stroke: '#9ca3af', strokeDasharray: '3 3' }}
              wrapperStyle={{ outline: 'none' }}
              content={<ChartTooltipContent />}
            />
            <Line
              type="monotone"
              dataKey="completed"
              stroke={weeklyChartConfig.completed.color}
              strokeWidth={2}
              dot={false}
              name={weeklyChartConfig.completed.label}
            />
            <Line
              type="monotone"
              dataKey="notCompleted"
              stroke={weeklyChartConfig.notCompleted.color}
              strokeWidth={2}
              dot={false}
              name={weeklyChartConfig.notCompleted.label}
            />
            <Line
              type="monotone"
              dataKey="overdue"
              stroke={weeklyChartConfig.overdue.color}
              strokeWidth={2}
              dot={false}
              name={weeklyChartConfig.overdue.label}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartContainer>
    </div>
  );
}

interface DriverCompletionPoint {
  driverId: string;
  driverName: string;
  completionRate: number;
  completed: number;
  total: number;
  color: string;
}

type DriverSortBy = 'name' | 'rate';

const driverCompletionConfig = {
  completionRate: { label: 'אחוז השלמה', color: '#16a34a' },
} as const;

function colorForRate(rate: number) {
  if (rate > 80) return '#16a34a'; // green
  if (rate >= 60) return '#eab308'; // yellow-500
  return '#ef4444'; // red
}

function useDriverCompletion() {
  const { range } = usePeriod();
  const [raw, setRaw] = React.useState<DriverCompletionPoint[] | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [sortBy, setSortBy] = React.useState<DriverSortBy>('rate');

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const u = new URL(
          '/api/tasks/analytics/driver-completion',
          window.location.origin
        );
        u.searchParams.set('from', range.start);
        u.searchParams.set('to', range.end);
        if (range.timezone) u.searchParams.set('tz', range.timezone);
        const resp = await fetch(u.toString());
        if (!resp.ok) throw new Error(await resp.text());
        const json = await resp.json();
        if (!json?.ok) throw new Error(json?.error || 'failed');
        const pts: DriverCompletionPoint[] = (json.drivers || []).map(
          (d: any) => ({
            driverId: d.driverId,
            driverName: d.driverName || '—',
            completionRate: d.completionRate ?? 0,
            completed: d.completed ?? 0,
            total: d.total ?? 0,
            color: colorForRate(d.completionRate ?? 0),
          })
        );
        if (!cancelled) setRaw(pts);
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'failed');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [range.start, range.end, range.timezone]);

  const data = React.useMemo(() => {
    if (!raw) return [];
    const copy = [...raw];
    if (sortBy === 'name') {
      copy.sort((a, b) =>
        a.driverName.localeCompare(b.driverName, 'he-IL')
      );
    } else {
      copy.sort((a, b) => b.completionRate - a.completionRate);
    }
    return copy;
  }, [raw, sortBy]);

  return { data, loading, error, sortBy, setSortBy };
}

function DriverCompletionChart() {
  const { data, loading, error, sortBy, setSortBy } = useDriverCompletion();

  if (loading) {
    return (
      <div className="mt-4 h-64 animate-pulse rounded-md bg-gray-100" />
    );
  }

  if (error) {
    return (
      <div className="mt-4 h-64 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
        שגיאה בטעינת נתוני השלמת משימות לפי נהג: {error}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="mt-4 flex h-64 items-center justify-center rounded-md border border-dashed border-gray-200 text-xs text-gray-500">
        אין נתונים להצגה עבור התקופה שנבחרה.
      </div>
    );
  }

  return (
    <div className="mt-4 flex h-64 flex-col gap-2">
      <div className="flex justify-end gap-2 text-[11px]">
        <button
          type="button"
          onClick={() => setSortBy('name')}
          className={`rounded border px-2 py-1 ${
            sortBy === 'name'
              ? 'border-toyota-primary bg-toyota-primary text-white'
              : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          מיון לפי שם
        </button>
        <button
          type="button"
          onClick={() => setSortBy('rate')}
          className={`rounded border px-2 py-1 ${
            sortBy === 'rate'
              ? 'border-toyota-primary bg-toyota-primary text-white'
              : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          מיון לפי אחוז השלמה
        </button>
      </div>
      <div className="flex-1">
        <ChartContainer
          config={driverCompletionConfig}
          className="h-full w-full"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 10, right: 16, left: 0, bottom: 24 }}
            >
              <CartesianGrid stroke="#e5e7eb" strokeDasharray="4 4" />
              <XAxis
                dataKey="driverName"
                tickLine={false}
                axisLine={false}
                interval={0}
                angle={-35}
                textAnchor="end"
                height={40}
                tick={{ fontSize: 10, fill: '#6b7280' }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tick={{ fontSize: 10, fill: '#6b7280' }}
                domain={[0, 100]}
              />
              <Tooltip
                cursor={{ fill: 'rgba(148, 163, 184, 0.15)' }}
                wrapperStyle={{ outline: 'none' }}
                content={<ChartTooltipContent />}
              />
              <Bar
                dataKey="completionRate"
                name={driverCompletionConfig.completionRate.label}
                radius={[4, 4, 0, 0]}
                label={({ x, y, width, value }) => {
                  if (typeof value !== 'number') return null;
                  const cx = (x ?? 0) + (width ?? 0) / 2;
                  const cy = (y ?? 0) - 6;
                  return (
                    <text
                      x={cx}
                      y={cy}
                      textAnchor="middle"
                      className="fill-gray-700 text-[10px]"
                    >
                      {`${value}%`}
                    </text>
                  );
                }}
              >
                {data.map((entry) => (
                  <Cell
                    key={entry.driverId}
                    fill={entry.color}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </div>
    </div>
  );
}

interface DriverDurationPoint {
  driverId: string;
  driverName: string;
  avgDurationMinutes: number;
  taskCount: number;
}

const driverDurationConfig = {
  avgDurationMinutes: {
    label: 'משך משימה ממוצע (דקות)',
    color: '#0ea5e9',
  },
} as const;

function useDriverDuration() {
  const { range } = usePeriod();
  const [data, setData] = React.useState<DriverDurationPoint[] | null>(null);
  const [globalAverage, setGlobalAverage] = React.useState<number>(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const u = new URL(
          '/api/tasks/analytics/driver-duration',
          window.location.origin
        );
        u.searchParams.set('from', range.start);
        u.searchParams.set('to', range.end);
        if (range.timezone) u.searchParams.set('tz', range.timezone);
        const resp = await fetch(u.toString());
        if (!resp.ok) throw new Error(await resp.text());
        const json = await resp.json();
        if (!json?.ok) throw new Error(json?.error || 'failed');
        if (!cancelled) {
          setData(
            (json.drivers || []).map((d: any) => ({
              driverId: d.driverId,
              driverName: d.driverName || '—',
              avgDurationMinutes: d.avgDurationMinutes ?? 0,
              taskCount: d.taskCount ?? 0,
            }))
          );
          setGlobalAverage(json.globalAverageMinutes ?? 0);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'failed');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [range.start, range.end, range.timezone]);

  return { data, globalAverage, loading, error };
}

function DriverDurationChart() {
  const { data, globalAverage, loading, error } = useDriverDuration();

  if (loading) {
    return (
      <div className="mt-4 h-64 animate-pulse rounded-md bg-gray-100" />
    );
  }

  if (error) {
    return (
      <div className="mt-4 h-64 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
        שגיאה בטעינת זמני משימות לפי נהג: {error}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="mt-4 flex h-64 items-center justify-center rounded-md border border-dashed border-gray-200 text-xs text-gray-500">
        אין נתונים להצגה עבור התקופה שנבחרה.
      </div>
    );
  }

  return (
    <div className="mt-4 h-64">
      <ChartContainer
        config={driverDurationConfig}
        className="h-full w-full"
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 10, right: 16, left: 0, bottom: 24 }}
          >
            <CartesianGrid stroke="#e5e7eb" strokeDasharray="4 4" />
            <XAxis
              dataKey="driverName"
              tickLine={false}
              axisLine={false}
              interval={0}
              angle={-35}
              textAnchor="end"
              height={40}
              tick={{ fontSize: 10, fill: '#6b7280' }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tick={{ fontSize: 10, fill: '#6b7280' }}
              allowDecimals={false}
            />
            <Tooltip
              cursor={{ fill: 'rgba(148, 163, 184, 0.15)' }}
              wrapperStyle={{ outline: 'none' }}
              content={<ChartTooltipContent />}
            />
            {globalAverage > 0 && (
              <ReferenceLine
                y={globalAverage}
                stroke="#6366f1"
                strokeDasharray="4 4"
              />
            )}
            <Bar
              dataKey="avgDurationMinutes"
              name={driverDurationConfig.avgDurationMinutes.label}
              radius={[4, 4, 0, 0]}
              fill={driverDurationConfig.avgDurationMinutes.color}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartContainer>
    </div>
  );
}

export function DashboardCharts() {
  return (
    <section className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Chart 1 - Weekly Task Trends (Line Chart) */}
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">
            מגמת משימות שבועית
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            קו המציג משימות שהושלמו, לא הושלמו ומשימות באיחור לאורך השבוע.
          </p>
          <WeeklyTrendsChart />
        </div>

        {/* Chart 2 - Driver Task Completion Comparison (Bar Chart) */}
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">
            השוואת השלמת משימות לפי נהג
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            אחוז השלמת משימות לכל נהג, כולל אפשרות למיון לפי ביצועים.
          </p>
          <DriverCompletionChart />
        </div>

        {/* Chart 3 - Driver Task Duration Analysis */}
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">
            ניתוח זמני טיפול במשימות לפי נהג
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            משך משימה ממוצע בדקות לכל נהג, עם אפשרות לפירוק לפי סוג משימה.
          </p>
          <DriverDurationChart />
        </div>
      </div>
    </section>
  );
}



