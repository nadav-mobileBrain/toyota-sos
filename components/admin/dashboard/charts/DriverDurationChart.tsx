'use client';

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart';
import { usePeriod } from '@/components/admin/dashboard/PeriodContext';

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

export function DriverDurationChart() {
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

