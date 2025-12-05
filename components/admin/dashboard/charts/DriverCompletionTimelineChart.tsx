'use client';

import React from 'react';
import {
  Area,
  AreaChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart';
import { usePeriod } from '@/components/admin/dashboard/PeriodContext';

interface TimelinePoint {
  date: string;
  drivers: Record<
    string,
    {
      name: string;
      completed: number;
    }
  >;
}

interface ChartDataPoint {
  date: string;
  [driverName: string]: string | number;
}

// Color palette for drivers
const DRIVER_COLORS = [
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
  '#6366f1', // indigo
  '#14b8a6', // teal
  '#a855f7', // purple-light
  '#0ea5e9', // sky
  '#f59e0b', // amber
  '#f97316', // orange
  '#ef4444', // red
  '#22c55e', // green
];

function useDriverTimeline() {
  const { range } = usePeriod();
  const [data, setData] = React.useState<TimelinePoint[] | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const u = new URL(
          '/api/tasks/analytics/driver-completion-timeline',
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
          setData(json.timeline || []);
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

export function DriverCompletionTimelineChart() {
  const { data, loading, error } = useDriverTimeline();

  // Transform data for recharts and build chart config
  const { chartData, chartConfig, driverNames, legendItems } = React.useMemo(() => {
    if (!data || data.length === 0) {
      return { chartData: [], chartConfig: {}, driverNames: [], legendItems: [] };
    }

    // Collect all unique driver IDs and names
    const driverMap = new Map<string, string>();
    data.forEach((point) => {
      Object.entries(point.drivers).forEach(([driverId, info]) => {
        if (!driverMap.has(driverId)) {
          driverMap.set(driverId, info.name);
        }
      });
    });

    const drivers = Array.from(driverMap.entries());
    const names = drivers.map(([, name]) => name);

    // Build chart config with colors
    const config: Record<string, { label: string; color: string }> = {};
    drivers.forEach(([driverId, name], index) => {
      const color =
        DRIVER_COLORS[index % DRIVER_COLORS.length] || '#6b7280';
      config[driverId] = { label: name, color };
    });

    // Build legend items from chart config
    const legend = Object.values(config).map((configItem) => ({
      label: configItem.label,
      color: configItem.color,
    }));

    // Transform timeline data to recharts format
    const transformed: ChartDataPoint[] = data.map((point) => {
      const result: ChartDataPoint = { date: point.date };
      Object.entries(point.drivers).forEach(([driverId, info]) => {
        result[driverId] = info.completed;
      });
      // Fill in zeros for drivers not present on this date
      drivers.forEach(([driverId]) => {
        if (result[driverId] === undefined) {
          result[driverId] = 0;
        }
      });
      return result;
    });

    return {
      chartData: transformed,
      chartConfig: config,
      driverNames: names,
      legendItems: legend,
    };
  }, [data]);

  if (loading) {
    return <div className="h-full animate-pulse rounded-md bg-gray-100" />;
  }

  if (error) {
    return (
      <div className="h-full rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700 flex items-center justify-center">
        שגיאה בטעינת נתוני השלמת משימות לפי נהג לאורך זמן: {error}
      </div>
    );
  }

  if (!chartData || chartData.length === 0) {
    return (
      <div className="flex h-full items-center justify-center rounded-md border border-dashed border-gray-200 text-xs text-gray-500">
        אין נתונים להצגה עבור התקופה שנבחרה.
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 min-h-0">
        <ChartContainer config={chartConfig} className="h-full w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 10, right: 16, left: 0, bottom: 0 }}
            >
              <CartesianGrid stroke="#e5e7eb" strokeDasharray="4 4" />
              <XAxis
                dataKey="date"
                tickFormatter={(value: string) =>
                  new Date(value).toLocaleDateString('he-IL', {
                    month: 'short',
                    day: 'numeric',
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
              {Object.entries(chartConfig).map(([driverId, config]) => (
                <Area
                  key={driverId}
                  type="monotone"
                  dataKey={driverId}
                  stackId="1"
                  stroke={config.color}
                  fill={config.color}
                  fillOpacity={0.6}
                  strokeWidth={1}
                  name={config.label}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </ChartContainer>
      </div>
      {/* Legend */}
      {legendItems.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-xs border-t border-gradient-to-r from-transparent via-slate-200 to-transparent pt-4 relative">
          <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-8 h-px bg-gradient-to-r from-toyota-red/30 to-toyota-blue/30" />
          {legendItems.map((item, idx) => (
            <div
              key={idx}
              className="group flex items-center gap-2 hover:scale-105 transition-all duration-200 cursor-pointer"
            >
              <div className="relative">
                <div
                  className="h-3 w-3 rounded-full border-2 border-white shadow-md group-hover:shadow-lg transition-all duration-200 group-hover:scale-110"
                  style={{ backgroundColor: item.color }}
                />
                <div
                  className="absolute inset-0 h-3 w-3 rounded-full opacity-0 group-hover:opacity-30 transition-opacity duration-200 blur-sm"
                  style={{ backgroundColor: item.color }}
                />
              </div>
              <span className="text-slate-600 font-semibold group-hover:text-slate-800 transition-colors duration-200">
                {item.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

