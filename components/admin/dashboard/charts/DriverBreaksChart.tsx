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

interface DriverBreakData {
  driver_id: string;
  driver_name: string;
  totalDurationMinutes: number;
  count: number;
}

const chartConfig = {
  totalDurationMinutes: {
    label: 'משך הפסקה כולל (דקות)',
    color: 'hsl(211.6981 96.3636% 78.4314%)', // Using a consistent blue/indigo from the theme
  },
} as const;

function useDriverBreaks() {
  const { range } = usePeriod();
  const [data, setData] = React.useState<DriverBreakData[] | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const u = new URL(
          '/api/drivers/analytics/breaks',
          window.location.origin
        );
        u.searchParams.set('from', range.start);
        u.searchParams.set('to', range.end);
        
        const resp = await fetch(u.toString());
        if (!resp.ok) throw new Error(await resp.text());
        const json = await resp.json();
        
        if (!json?.ok) throw new Error(json?.error || 'failed');
        
        if (!cancelled) {
          setData(json.data);
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
  }, [range.start, range.end]);

  return { data, loading, error };
}

export function DriverBreaksChart() {
  const { data, loading, error } = useDriverBreaks();

  if (loading) {
    return (
      <div className="h-full w-full animate-pulse bg-slate-100 rounded flex items-center justify-center">
        <span className="sr-only">טוען נתונים...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700 flex items-center justify-center">
        שגיאה בטעינת נתוני הפסקות: {error}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center rounded-md border border-dashed border-gray-200 text-xs text-gray-500">
        אין נתוני הפסקות לתקופה זו
      </div>
    );
  }

  return (
    <div className="h-full w-full" dir="ltr">
      <ChartContainer config={chartConfig} className="h-full w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 10, right: 30, left: 30, bottom: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
            <XAxis 
                dataKey="driver_name"
                tickLine={false}
                axisLine={false}
                interval={0}
                tick={{ fontSize: 10, fill: '#6b7280' }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10, fill: '#6b7280' }}
              label={{ value: 'דקות', angle: -90, position: 'insideLeft', style: { fill: '#9ca3af', fontSize: '10px' } }}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const item = payload[0].payload as DriverBreakData;
                  return (
                    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-lg text-xs" dir="rtl">
                      <div className="font-bold text-slate-800 mb-1">{item.driver_name}</div>
                      <div className="text-slate-600">
                        משך כולל: <span className="font-semibold">{item.totalDurationMinutes} דקות</span>
                      </div>
                      <div className="text-slate-600">
                        מספר הפסקות: <span className="font-semibold">{item.count}</span>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar
              dataKey="totalDurationMinutes"
              fill="var(--color-totalDurationMinutes)"
              radius={[4, 4, 0, 0]}
              barSize={30}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartContainer>
    </div>
  );
}
