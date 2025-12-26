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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { usePeriod } from '@/components/admin/dashboard/PeriodContext';
import { TaskStatus, TaskType } from '@/types/task';
import { ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Status colors - using CSS chart colors
const STATUS_COLORS: Record<TaskStatus, string> = {
  בהמתנה: 'hsl(213.3333 96.9231% 87.2549%)', // --chart-4
  בעבודה: 'hsl(221.2121 83.1933% 53.3333%)', // --chart-1
  חסומה: 'hsl(0 84.2365% 60.1961%)', // --destructive
  הושלמה: 'hsl(213.1169 93.9024% 67.8431%)', // --chart-2
};

// Display names for statuses
const STATUS_DISPLAY_NAMES: Record<TaskStatus, string> = {
  בהמתנה: 'ממתינה לביצוע',
  בעבודה: 'בביצוע',
  חסומה: 'חסומה',
  הושלמה: 'בוצעה',
};

// Colors for task types - more distinct colors
const TYPE_COLORS: Record<string, string> = {
  'איסוף רכב/שינוע': 'hsl(221 83% 53%)', // Blue
  'החזרת רכב/שינוע': 'hsl(142 76% 36%)', // Green
  'מסירת רכב חלופי': 'hsl(280 65% 60%)', // Purple
  'הסעת לקוח הביתה': 'hsl(38 92% 50%)', // Orange
  'הסעת לקוח למוסך': 'hsl(340 82% 52%)', // Pink/Red
  'ביצוע טסט': 'hsl(199 89% 48%)', // Cyan
  'חילוץ רכב תקוע': 'hsl(0 84% 60%)', // Red
  אחר: 'hsl(215 20% 65%)', // Gray
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

// Custom Label Component
const renderCustomLabel = (entry: any) => {
  const { cx, cy, midAngle, outerRadius, value } = entry;
  const RADIAN = Math.PI / 180;
  const radius = outerRadius + 15;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="hsl(222.2 47.4% 11.2%)"
      textAnchor={x > cx ? 'start' : 'end'}
      dominantBaseline="central"
      className="text-xs font-bold"
    >
      {value}
    </text>
  );
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
        name: STATUS_DISPLAY_NAMES[status as TaskStatus] || status,
        value: count,
        fill: STATUS_COLORS[status as TaskStatus] || '#9ca3af',
      }))
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [data, selectedDrillDown]);

  // Define chart config dynamically based on current view
  const currentConfig = useMemo(() => {
    if (selectedDrillDown) {
      return Object.entries(STATUS_COLORS).reduce(
        (acc, [status, color]) => ({
          ...acc,
          [STATUS_DISPLAY_NAMES[status as TaskStatus]]: {
            label: STATUS_DISPLAY_NAMES[status as TaskStatus],
            color,
          },
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
      <Card className="group h-[450px] border-0 shadow-lg shadow-slate-900/5 bg-gradient-to-br from-white/98 via-white/95 to-indigo-50/20 backdrop-blur-md animate-pulse">
        <CardHeader className="pb-3">
          <div className="h-4 w-32 rounded bg-slate-200" />
          <div className="h-3 w-48 rounded bg-slate-150" />
        </CardHeader>
        <CardContent>
          <div className="h-60 w-full rounded bg-slate-200" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="h-[450px] border-0 border-r-4 border-r-red-300 bg-gradient-to-br from-red-50/80 via-red-25/50 to-white shadow-lg shadow-red-900/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold text-red-700">
            שגיאה בטעינת נתונים
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-red-600">{error}</div>
        </CardContent>
      </Card>
    );
  }

  const chartData = selectedDrillDown ? drillDownData : typeDistributionData;

  return (
    <Card className="group h-[520px] border-0 shadow-lg shadow-slate-900/5 bg-gradient-to-br from-white/98 via-white/95 to-indigo-50/20 backdrop-blur-md transition-all duration-300 hover:shadow-xl hover:shadow-slate-900/10 hover:scale-[1.01] transform-gpu border-l-4 border-l-transparent hover:border-l-indigo-400/60 overflow-hidden relative">
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-radial from-indigo-100/20 to-transparent rounded-full transform translate-x-16 -translate-y-16" />
      <CardHeader className="pb-4 relative z-10">
        <div className="flex items-center justify-between">
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
            <CardTitle className="text-lg font-bold text-slate-800 group-hover:text-slate-900 transition-colors duration-200 flex items-center gap-2">
              <div className="w-2 h-2 bg-indigo-500 rounded-full group-hover:scale-125 transition-transform duration-200" />
              {selectedDrillDown
                ? `סטטוסים: ${selectedDrillDown}`
                : 'התפלגות סוגי משימות'}
            </CardTitle>
          </div>
        </div>
        <CardDescription className="text-slate-600 group-hover:text-slate-700 transition-colors duration-200 font-medium">
          {selectedDrillDown
            ? 'התפלגות סטטוסי המשימות לפי סוג נבחר'
            : 'התפלגות המשימות לפי סוג - לחץ על פלח לפירוט סטטוסים'}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0 relative z-10 flex flex-col">
        <div className="h-[380px]">
          {!data || chartData.length === 0 ? (
            <div className="flex h-full items-center justify-center text-xs text-gray-500">
              אין נתונים להצגה
            </div>
          ) : (
            <ChartContainer
              config={currentConfig}
              className="h-full w-full mx-auto"
            >
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 10, right: 10, bottom: 70, left: 10 }}>
                  <Pie
                    data={chartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="42%"
                    outerRadius={85}
                    label={renderCustomLabel}
                    labelLine={false}
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
                  <Legend
                    layout="horizontal"
                    verticalAlign="bottom"
                    align="center"
                    iconType="circle"
                    wrapperStyle={{ bottom: 0, left: 0, right: 0 }}
                    content={(props) => {
                      const { payload } = props;
                      // Ensure payload is sorted by value descending
                      const sortedPayload = payload
                        ? [...payload].sort(
                            (a: any, b: any) =>
                              b.payload.value - a.payload.value
                          )
                        : [];

                      return (
                        <div className="flex flex-wrap justify-center gap-x-2 gap-y-1 px-2 max-h-[50px] overflow-y-auto custom-scrollbar">
                          {sortedPayload.map((entry: any, index: number) => (
                            <div
                              key={`item-${index}`}
                              className="flex items-center gap-1 text-[9px] text-gray-600"
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
      </CardContent>
    </Card>
  );
}
