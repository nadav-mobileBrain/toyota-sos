'use client';

import React, { useMemo, useState } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart';
import { usePeriod } from '@/components/admin/dashboard/PeriodContext';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TaskStatus, TaskPriority } from '@/types/task';

// Status colors
const STATUS_COLORS: Record<TaskStatus, string> = {
  'בהמתנה': '#f59e0b', // amber-500
  'בעבודה': '#3b82f6', // blue-500
  'חסומה': '#ef4444', // red-500
  'הושלמה': '#16a34a', // green-600
};

const CHART_CONFIG = {
  'בהמתנה': { label: 'בהמתנה', color: STATUS_COLORS['בהמתנה'] },
  'בעבודה': { label: 'בעבודה', color: STATUS_COLORS['בעבודה'] },
  'חסומה': { label: 'חסומה', color: STATUS_COLORS['חסומה'] },
  'הושלמה': { label: 'הושלמה', color: STATUS_COLORS['הושלמה'] },
};

export function StatusByPriorityChart() {
  const { range } = usePeriod();
  const [data, setData] = useState<Record<string, Record<TaskStatus, number>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPriority, setSelectedPriority] = useState<TaskPriority>('גבוהה');

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
        u.searchParams.set('groupBy', 'priority');
        
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
  }, [range.start, range.end, range.timezone]);

  const chartData = useMemo(() => {
    if (!data || !data[selectedPriority]) return [];
    
    const priorityData = data[selectedPriority];
    return Object.entries(priorityData).map(([status, count]) => ({
      name: status,
      value: count,
      fill: STATUS_COLORS[status as TaskStatus] || '#9ca3af'
    })).filter(item => item.value > 0);
  }, [data, selectedPriority]);

  const totalTasks = useMemo(() => {
    return chartData.reduce((acc, curr) => acc + curr.value, 0);
  }, [chartData]);

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

  return (
    <div className="flex h-80 flex-col rounded-xl border-2 border-primary bg-white p-4 shadow-md transition-all duration-200 hover:border-primary/50 hover:shadow-lg">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">
          סטטוס לפי עדיפות
        </h2>
        <Select
          value={selectedPriority}
          onValueChange={(val) => setSelectedPriority(val as TaskPriority)}
        >
          <SelectTrigger className="h-8 w-[110px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="גבוהה">גבוהה</SelectItem>
            <SelectItem value="בינונית">בינונית</SelectItem>
            <SelectItem value="נמוכה">נמוכה</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1">
        {(!data || chartData.length === 0) ? (
          <div className="flex h-full items-center justify-center text-xs text-gray-500">
             אין נתונים להצגה
          </div>
        ) : (
          <ChartContainer config={CHART_CONFIG} className="h-full w-full mx-auto aspect-square max-h-[250px]">
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
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} strokeWidth={0} />
                  ))}
                </Pie>
                <Tooltip
                  content={<ChartTooltipContent hideLabel />}
                  cursor={false}
                />
                <text
                  x="50%"
                  y="50%"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-foreground text-2xl font-bold"
                >
                  {totalTasks}
                </text>
                <text
                  x="50%"
                  y="50%"
                  dy={20}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-muted-foreground text-xs"
                >
                  משימות
                </text>
                <Legend 
                  layout="horizontal" 
                  verticalAlign="bottom" 
                  align="center"
                  iconType="circle"
                  formatter={(value) => <span className="text-xs text-gray-600 ml-1">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </ChartContainer>
        )}
      </div>
    </div>
  );
}

