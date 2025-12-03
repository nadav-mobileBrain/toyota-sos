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
} from 'recharts';
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart';
import { usePeriod } from '@/components/admin/dashboard/PeriodContext';

interface WeeklyPoint {
  date: string;
  completed: number;
  notCompleted: number;
  overdue: number;
  total: number;
}

const weeklyChartConfig = {
  completed: { label: 'הושלמו', color: 'hsl(213.1169 93.9024% 67.8431%)' }, // --chart-2 from globals.css
  notCompleted: { label: 'לא הושלמו', color: 'hsl(211.6981 96.3636% 78.4314%)' }, // --chart-3 from globals.css
  overdue: { label: 'באיחור', color: 'hsl(213.3333 96.9231% 87.2549%)' }, // --chart-4 from globals.css
  total: { label: 'סה״כ משימות', color: 'hsl(221.2121 83.1933% 53.3333%)' }, // --chart-1 from globals.css
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
        if (!cancelled) {
          // Filter out Saturdays (day 6)
          const points = (json.points || []).filter((p: WeeklyPoint) => {
            const d = new Date(p.date);
            return d.getDay() !== 6;
          });
          setData(points);
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

  return { data, loading, error };
}

export function WeeklyTrendsChart() {
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
              dataKey="total"
              stroke={weeklyChartConfig.total.color}
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
              name={weeklyChartConfig.total.label}
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

