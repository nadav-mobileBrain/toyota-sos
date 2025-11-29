'use client';

import React, { useMemo, useState } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { ChartContainer } from '@/components/ui/chart';
import { usePeriod } from '@/components/admin/dashboard/PeriodContext';
import { TaskStatus, TaskType } from '@/types/task';
import { ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Status colors
const STATUS_COLORS: Record<TaskStatus, string> = {
  בהמתנה: '#f59e0b', // amber-500
  בעבודה: '#3b82f6', // blue-500
  חסומה: '#ef4444', // red-500
  הושלמה: '#16a34a', // green-600
};

// Colors for task types
const TYPE_COLORS: Record<string, string> = {
  'איסוף רכב/שינוע': '#3b82f6', // blue-500
  'החזרת רכב/שינוע': '#10b981', // emerald-500
  'הסעת רכב חלופי': '#8b5cf6', // violet-500
  'הסעת לקוח הביתה': '#f59e0b', // amber-500
  'הסעת לקוח למוסך': '#ec4899', // pink-500
  'ביצוע טסט': '#6366f1', // indigo-500
  'חילוץ רכב תקוע': '#ef4444', // red-500
  אחר: '#6b7280', // gray-500
};

// Custom Tooltip Component
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-2 shadow-md text-xs">
        <div className="flex items-center gap-2">
          <div
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: data.fill }}
          />
          <span className="font-medium text-gray-700">{data.name}:</span>
          <span className="font-bold text-gray-900">{data.value}</span>
        </div>
      </div>
    );
  }
  return null;
};

export function StatusByTypeChart() {
  const { range } = usePeriod();
  const [data, setData] = useState<Record<
    string,
    Record<TaskStatus, number>
  > | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDrillDown, setSelectedDrillDown] = useState<TaskType | null>(
    null
  );

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const u = new URL(
          '/api/tasks/analytics/status-breakdown',
          window.location.origin
        );
        u.searchParams.set('from', range.start);
        u.searchParams.set('to', range.end);
        u.searchParams.set('groupBy', 'type');

        const resp = await fetch(u.toString());
        if (!resp.ok) throw new Error(await resp.text());
        const json = await resp.json();

        if (!json?.ok) throw new Error(json?.error || 'failed');
        if (!cancelled) {
          setData(json.data);
          // Reset drill down on data refresh
          setSelectedDrillDown(null);
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

  // Main View: Distribution of Task Types (Count of tasks per type)
  const typeDistributionData = useMemo(() => {
    if (!data) return [];

    return Object.entries(data)
      .map(([type, statusCounts]) => {
        const totalForType = Object.values(statusCounts).reduce(
          (a, b) => a + b,
          0
        );
        return {
          name: type,
          value: totalForType,
          fill: TYPE_COLORS[type] || TYPE_COLORS['אחר'],
        };
      })
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [data]);

  // Drill Down View: Status distribution for selected type
  const drillDownData = useMemo(() => {
    if (!data || !selectedDrillDown || !data[selectedDrillDown]) return [];

    const typeData = data[selectedDrillDown];
    return Object.entries(typeData)
      .map(([status, count]) => ({
        name: status,
        value: count,
        fill: STATUS_COLORS[status as TaskStatus] || '#9ca3af',
      }))
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [data, selectedDrillDown]);

  const totalTasks = useMemo(() => {
    if (selectedDrillDown) {
      return drillDownData.reduce((acc, curr) => acc + curr.value, 0);
    }
    return typeDistributionData.reduce((acc, curr) => acc + curr.value, 0);
  }, [typeDistributionData, drillDownData, selectedDrillDown]);

  // Define chart config dynamically based on current view
  const currentConfig = useMemo(() => {
    if (selectedDrillDown) {
      return Object.entries(STATUS_COLORS).reduce(
        (acc, [status, color]) => ({
          ...acc,
          [status]: { label: status, color },
        }),
        {}
      );
    }
    return Object.entries(TYPE_COLORS).reduce(
      (acc, [type, color]) => ({
        ...acc,
        [type]: { label: type, color },
      }),
      {}
    );
  }, [selectedDrillDown]);

  if (loading) {
    return (
      <div className="h-80 animate-pulse rounded-xl border-2 border-primary bg-white p-4 shadow-md" />
    );
  }

  if (error) {
    return (
      <div className="h-80 rounded-xl border-2 border-red-200 bg-red-50 p-4 text-xs text-red-700 shadow-md">
        שגיאה בטעינת נתונים: {error}
      </div>
    );
  }

  const chartData = selectedDrillDown ? drillDownData : typeDistributionData;

  return (
    <div className="flex h-80 flex-col rounded-xl border-2 border-primary bg-white p-4 shadow-md transition-all duration-200 hover:border-primary/50 hover:shadow-lg">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {selectedDrillDown && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setSelectedDrillDown(null)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
          <h2 className="text-sm font-semibold text-gray-900">
            {selectedDrillDown
              ? `סטטוסים: ${selectedDrillDown}`
              : 'התפלגות סוגי משימות'}
          </h2>
        </div>
      </div>

      <div className="flex-1">
        {!data || chartData.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-gray-500">
            אין נתונים להצגה
          </div>
        ) : (
          <ChartContainer
            config={currentConfig}
            className="h-full w-full mx-auto aspect-square max-h-[250px]"
          >
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={2}
                  onClick={(entry) => {
                    if (!selectedDrillDown) {
                      setSelectedDrillDown(entry.name as TaskType);
                    }
                  }}
                  className={
                    !selectedDrillDown
                      ? 'cursor-pointer outline-none'
                      : 'outline-none'
                  }
                >
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.fill}
                      strokeWidth={0}
                      className={
                        !selectedDrillDown
                          ? 'hover:opacity-80 transition-opacity'
                          : ''
                      }
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} cursor={false} />
                <text
                  x="50%"
                  y="40%"
                  dy={-5}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-foreground text-3xl font-bold"
                >
                  {totalTasks}
                </text>
                <text
                  x="50%"
                  y="40%"
                  dy={20}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-muted-foreground text-sm font-medium"
                >
                  משימות
                </text>
                <Legend
                  layout="horizontal"
                  verticalAlign="bottom"
                  align="center"
                  iconType="circle"
                  content={(props) => {
                    const { payload } = props;
                    // Ensure payload is sorted by value descending
                    const sortedPayload = payload
                      ? [...payload].sort(
                          (a: any, b: any) => b.payload.value - a.payload.value
                        )
                      : [];

                    return (
                      <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-2 max-h-[80px] overflow-y-auto custom-scrollbar">
                        {sortedPayload.map((entry: any, index: number) => (
                          <div
                            key={`item-${index}`}
                            className="flex items-center gap-1.5 text-[10px] text-gray-600"
                          >
                            <div
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: entry.color }}
                            />
                            <span className="whitespace-nowrap">
                              {entry.value}{' '}
                              <span className="font-bold text-gray-900">
                                ({entry.payload.value})
                              </span>
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </ChartContainer>
        )}
      </div>
      {!selectedDrillDown && typeDistributionData.length > 0 && (
        <div className="mt-1 text-center text-[10px] text-gray-400">
          לחץ על פלח לפירוט סטטוסים
        </div>
      )}
    </div>
  );
}
