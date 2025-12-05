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
} from 'recharts';
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart';
import { usePeriod } from '@/components/admin/dashboard/PeriodContext';

interface DriverCompletionPoint {
  driverId: string;
  driverName: string;
  completionRate: number;
  completed: number;
  incomplete: number;
  total: number;
}

type DriverSortBy = 'name' | 'rate' | 'total';

const driverCompletionConfig = {
  completed: { label: 'בוצעו', color: '#10b981' },
  incomplete: { label: 'לא בוצעו', color: '#f59e0b' },
} as const;


function useDriverCompletion() {
  const { range } = usePeriod();
  const [raw, setRaw] = React.useState<DriverCompletionPoint[] | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [sortBy, setSortBy] = React.useState<DriverSortBy>('total');

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
          (d: {
            driverId: string;
            driverName: string;
            completionRate: number;
            completed: number;
            total: number;
          }) => {
            const completed = d.completed ?? 0;
            const total = d.total ?? 0;
            return {
              driverId: d.driverId,
              driverName: d.driverName || '—',
              completionRate: d.completionRate ?? 0,
              completed,
              incomplete: Math.max(0, total - completed),
              total,
            };
          }
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
      copy.sort((a, b) => a.driverName.localeCompare(b.driverName, 'he-IL'));
    } else if (sortBy === 'rate') {
      copy.sort((a, b) => b.completionRate - a.completionRate);
    } else {
      copy.sort((a, b) => b.total - a.total);
    }
    return copy;
  }, [raw, sortBy]);

  return { data, loading, error, sortBy, setSortBy };
}

export function DriverCompletionChart() {
  const { data, loading, error } = useDriverCompletion();

  if (loading) {
    return <div className="h-full animate-pulse rounded-md bg-gray-100" />;
  }

  if (error) {
    return (
      <div className="h-full rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700 flex items-center justify-center">
        שגיאה בטעינת נתוני השלמת משימות לפי נהג: {error}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center rounded-md border border-dashed border-gray-200 text-xs text-gray-500">
        אין נתונים להצגה עבור התקופה שנבחרה.
      </div>
    );
  }

  return (
    <div className="h-full">
      <ChartContainer config={driverCompletionConfig} className="h-full w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 10, right: 16, left: 0, bottom: 0 }}
          >
            <CartesianGrid stroke="#e5e7eb" strokeDasharray="4 4" />
            <XAxis
              dataKey="driverName"
              tickLine={false}
              axisLine={true}
              interval={0}
              angle={-35}
              textAnchor="end"
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
            <Bar
              dataKey="completed"
              stackId="a"
              name={driverCompletionConfig.completed.label}
              fill={driverCompletionConfig.completed.color}
              radius={[0, 0, 0, 0]}
            />
            <Bar
              dataKey="incomplete"
              stackId="a"
              name={driverCompletionConfig.incomplete.label}
              fill={driverCompletionConfig.incomplete.color}
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartContainer>
    </div>
  );
}
