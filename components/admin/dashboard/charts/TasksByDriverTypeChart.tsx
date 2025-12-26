'use client';

import React, { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from 'recharts';
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { usePeriod } from '@/components/admin/dashboard/PeriodContext';
import { TaskType } from '@/types/task';

interface TaskTypeCount {
  taskType: string;
  count: number;
}

interface DriverData {
  driverId: string;
  driverName: string;
  taskTypes: TaskTypeCount[];
  total: number;
}

// Colors for task types - matching StatusByTypeChart
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

function useTasksByDriverType() {
  const { range } = usePeriod();
  const [data, setData] = React.useState<DriverData[] | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const u = new URL(
          '/api/tasks/analytics/tasks-by-driver-type',
          window.location.origin
        );
        u.searchParams.set('from', range.start);
        u.searchParams.set('to', range.end);
        if (range.timezone) u.searchParams.set('tz', range.timezone);
        const resp = await fetch(u.toString());
        if (!resp.ok) throw new Error(await resp.text());
        const json = await resp.json();
        if (!json?.ok) throw new Error(json?.error || 'failed');
        const drivers: DriverData[] = json.drivers || [];
        if (!cancelled) setData(drivers);
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

// Prepare data for stacked bar chart
function prepareChartData(
  drivers: DriverData[],
  taskTypesToShow: string[]
): Array<Record<string, any>> {
  // Create chart data: one entry per driver
  return drivers.map((driver) => {
    const entry: Record<string, any> = {
      driverName: driver.driverName,
      driverId: driver.driverId,
      total: 0, // Will recalculate based on filtered types
    };

    // Add count for each task type (0 if driver doesn't have that type)
    let filteredTotal = 0;
    taskTypesToShow.forEach((taskType) => {
      const typeData = driver.taskTypes.find((tt) => tt.taskType === taskType);
      const count = typeData ? typeData.count : 0;
      entry[taskType] = count;
      filteredTotal += count;
    });

    entry.total = filteredTotal;

    return entry;
  }).filter((entry) => entry.total > 0); // Only show drivers with tasks in selected types
}

// Create chart config for each task type
function createChartConfig(taskTypes: string[]) {
  const config: Record<string, { label: string; color: string }> = {};
  taskTypes.forEach((taskType) => {
    config[taskType] = {
      label: taskType,
      color: TYPE_COLORS[taskType] || TYPE_COLORS['אחר'],
    };
  });
  return config;
}

export function TasksByDriverTypeChart() {
  const { data, loading, error } = useTasksByDriverType();
  const [selectedTaskTypes, setSelectedTaskTypes] = useState<Set<string>>(
    new Set()
  );

  const { chartData, taskTypes, chartConfig, allTaskTypes } = useMemo(() => {
    if (!data || data.length === 0) {
      return { chartData: [], taskTypes: [], chartConfig: {}, allTaskTypes: [] };
    }

    const allTaskTypesSet = new Set<string>();
    data.forEach((driver) => {
      driver.taskTypes.forEach((tt) => allTaskTypesSet.add(tt.taskType));
    });

    const taskTypesArray = Array.from(allTaskTypesSet).sort();
    
    // Filter task types if selection is active
    const filteredTaskTypes =
      selectedTaskTypes.size > 0
        ? taskTypesArray.filter((tt) => selectedTaskTypes.has(tt))
        : taskTypesArray;
    
    const preparedData = prepareChartData(data, filteredTaskTypes);
    const config = createChartConfig(taskTypesArray);

    return {
      chartData: preparedData,
      taskTypes: filteredTaskTypes,
      chartConfig: config,
      allTaskTypes: taskTypesArray,
    };
  }, [data, selectedTaskTypes]);

  const handleLegendClick = (taskType: string) => {
    setSelectedTaskTypes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(taskType)) {
        newSet.delete(taskType);
      } else {
        newSet.add(taskType);
      }
      // If all types are selected or none are selected, clear selection to show all
      if (!data) return new Set();
      const allTaskTypesSet = new Set<string>();
      data.forEach((driver) => {
        driver.taskTypes.forEach((tt) => allTaskTypesSet.add(tt.taskType));
      });
      if (newSet.size === 0 || newSet.size === allTaskTypesSet.size) {
        return new Set();
      }
      return newSet;
    });
  };

  if (loading) {
    return <div className="h-full animate-pulse rounded-md bg-gray-100" />;
  }

  if (error) {
    return (
      <div className="h-full rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700 flex items-center justify-center">
        שגיאה בטעינת נתוני פילוח משימות לפי נהג: {error}
      </div>
    );
  }

  if (!data || chartData.length === 0) {
    return (
      <div className="flex h-full items-center justify-center rounded-md border border-dashed border-gray-200 text-xs text-gray-500">
        אין נתונים להצגה עבור התקופה שנבחרה.
      </div>
    );
  }

  // Get all task types for legend (not filtered)
  const allTaskTypesForLegend = allTaskTypes.length > 0 
    ? allTaskTypes 
    : Object.keys(chartConfig);

  return (
    <Card className="group h-[450px] border-0 shadow-lg shadow-slate-900/5 bg-linear-to-br from-white/98 via-white/95 to-purple-50/20 backdrop-blur-md transition-all duration-300 hover:shadow-xl hover:shadow-slate-900/10 hover:scale-[1.01] transform-gpu border-l-4 border-l-transparent hover:border-l-purple-400/60 overflow-hidden relative flex flex-col">
      <div className="absolute inset-0 bg-linear-to-br from-purple-50/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-radial from-purple-100/20 to-transparent rounded-full transform translate-x-16 -translate-y-16" />
      <CardHeader className="pb-4 relative z-10">
        <CardTitle className="text-lg font-bold text-slate-800 group-hover:text-slate-900 transition-colors duration-200 flex items-center gap-2">
          <div className="w-2 h-2 bg-purple-500 rounded-full group-hover:scale-125 transition-transform duration-200" />
          פילוח סוגי משימות לפי נהג
        </CardTitle>
        <CardDescription className="text-slate-600 group-hover:text-slate-700 transition-colors duration-200 font-medium">
          כמות משימות מכל סוג שבוצעו על ידי כל נהג בתקופה הנבחרת
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0 relative z-10 flex flex-col flex-1 min-h-0">
        <div className="h-[320px]">
          <ChartContainer config={chartConfig} className="h-full w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 10, right: 30, left: 30, bottom: 60 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis
                  type="category"
                  dataKey="driverName"
                  tick={{ fontSize: 11, fill: '#1f2937', fontWeight: 600 }}
                  interval={0}
                  axisLine={false}
                  tickLine={false}
                  tickMargin={8}
                />
                <YAxis
                  type="number"
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  tickFormatter={(value) => Math.round(value).toString()}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(148, 163, 184, 0.1)' }}
                  wrapperStyle={{ 
                    backgroundColor: 'white',
                    opacity: 1,
                    zIndex: 9999
                  }}
                  content={({ active, payload }) => {
                    if (!active || !payload || payload.length === 0) {
                      return null;
                    }
                    const driverName = payload[0].payload.driverName;
                    const total = payload[0].payload.total;
                    const activeItems = payload
                      .filter((item) => item.value && Number(item.value) > 0)
                      .map((item) => ({
                        taskType: item.name as string,
                        count: Number(item.value),
                        color:
                          chartConfig[item.name as string]?.color ||
                          TYPE_COLORS['אחר'],
                      }))
                      .sort((a, b) => b.count - a.count); // Sort descending by count
                    
                    if (activeItems.length === 0) return null;

                    return (
                      <div 
                        className="rounded-lg border-2 border-gray-400 p-4 shadow-2xl min-w-[220px] bg-white"
                        style={{ 
                          backgroundColor: '#ffffff',
                          opacity: 1,
                          background: '#ffffff',
                          backdropFilter: 'none',
                          WebkitBackdropFilter: 'none',
                          zIndex: 9999
                        }}
                      >
                        <div className="mb-3 font-bold text-base text-gray-900 border-b-2 border-gray-300 pb-2">
                          {driverName}
                        </div>
                        <div className="space-y-2 max-h-[300px] overflow-y-auto">
                          {activeItems.map((item, index) => (
                            <div
                              key={index}
                              className="flex items-center justify-between gap-4 text-sm"
                            >
                              <div className="flex items-center gap-2.5 flex-1 min-w-0" dir="rtl">
                                <div
                                  className="h-3.5 w-3.5 rounded-full shrink-0"
                                  style={{ backgroundColor: item.color }}
                                />
                                <span className="text-gray-700 truncate">
                                  {item.taskType}
                                </span>
                              </div>
                              <span className="font-bold text-gray-900 shrink-0">
                                {item.count}
                              </span>
                            </div>
                          ))}
                          <div className="mt-3 pt-3 border-t-2 border-gray-300 flex items-center justify-between" dir="rtl">
                            <span className="text-sm font-bold text-gray-900">
                              סה״כ:
                            </span>
                            <span className="text-sm font-bold text-gray-900">
                              {total} משימות
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  }}
                />
                <Legend
                  wrapperStyle={{ paddingTop: '20px' }}
                  iconType="circle"
                  formatter={(value) => value}
                  iconSize={8}
                  content={(props) => {
                    const { payload } = props;
                    if (!payload) return null;
                    return (
                      <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 px-2">
                        {allTaskTypesForLegend.map((taskType, index) => {
                          const isSelected =
                            selectedTaskTypes.size === 0 ||
                            selectedTaskTypes.has(taskType);
                          return (
                            <div
                              key={`legend-${index}`}
                              className="flex items-center gap-1.5 text-xs cursor-pointer hover:opacity-70 transition-opacity"
                              onClick={() => handleLegendClick(taskType)}
                              style={{
                                opacity: isSelected ? 1 : 0.4,
                                fontWeight: isSelected ? 600 : 400,
                              }}
                            >
                              <div
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{
                                  backgroundColor:
                                    chartConfig[taskType]?.color ||
                                    TYPE_COLORS['אחר'],
                                }}
                              />
                              <span className="text-gray-700 whitespace-nowrap">
                                {taskType}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  }}
                />
                {allTaskTypes.map((taskType) => {
                  const isSelected =
                    selectedTaskTypes.size === 0 ||
                    selectedTaskTypes.has(taskType);
                  return (
                    <Bar
                      key={taskType}
                      dataKey={taskType}
                      stackId="a"
                      fill={
                        isSelected
                          ? chartConfig[taskType]?.color || TYPE_COLORS['אחר']
                          : '#e5e7eb'
                      }
                      radius={[4, 4, 0, 0]}
                      opacity={isSelected ? 1 : 0.2}
                      hide={!isSelected && selectedTaskTypes.size > 0}
                    />
                  );
                })}
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </div>
      </CardContent>
    </Card>
  );
}

