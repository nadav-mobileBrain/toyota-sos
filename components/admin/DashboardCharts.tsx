'use client';

import dynamic from 'next/dynamic';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

const DriverCompletionTrendChart = dynamic(
  () =>
    import(
      '@/components/admin/dashboard/charts/DriverCompletionTrendChart'
    ).then((mod) => ({ default: mod.DriverCompletionTrendChart })),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full animate-pulse bg-slate-100 rounded" />
    ),
  }
);

const WeeklyTrendsChart = dynamic(
  () =>
    import('@/components/admin/dashboard/charts/WeeklyTrendsChart').then(
      (mod) => ({ default: mod.WeeklyTrendsChart })
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full animate-pulse bg-slate-100 rounded" />
    ),
  }
);

const DriverCompletionChart = dynamic(
  () =>
    import('@/components/admin/dashboard/charts/DriverCompletionChart').then(
      (mod) => ({ default: mod.DriverCompletionChart })
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full animate-pulse bg-slate-100 rounded" />
    ),
  }
);

const DriverDurationChart = dynamic(
  () =>
    import('@/components/admin/dashboard/charts/DriverDurationChart').then(
      (mod) => ({ default: mod.DriverDurationChart })
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full animate-pulse bg-slate-100 rounded" />
    ),
  }
);

const StatusByPriorityChart = dynamic(
  () =>
    import('@/components/admin/dashboard/charts/StatusByPriorityChart').then(
      (mod) => ({ default: mod.StatusByPriorityChart })
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full animate-pulse bg-slate-100 rounded" />
    ),
  }
);

const StatusByTypeChart = dynamic(
  () =>
    import('@/components/admin/dashboard/charts/StatusByTypeChart').then(
      (mod) => ({ default: mod.StatusByTypeChart })
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full animate-pulse bg-slate-100 rounded" />
    ),
  }
);

const TasksByDriverTypeChart = dynamic(
  () =>
    import(
      '@/components/admin/dashboard/charts/TasksByDriverTypeChart'
    ).then((mod) => ({ default: mod.TasksByDriverTypeChart })),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full animate-pulse bg-slate-100 rounded" />
    ),
  }
);

const DriverBreaksChart = dynamic(
  () =>
    import('@/components/admin/dashboard/charts/DriverBreaksChart').then(
      (mod) => ({ default: mod.DriverBreaksChart })
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full animate-pulse bg-slate-100 rounded" />
    ),
  }
);

function ChartLegend({
  items,
}: {
  items: Array<{ label: string; color: string }>;
}) {
  return (
    <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-xs border-t border-gradient-to-r from-transparent via-slate-200 to-transparent pt-4 relative">
      <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-8 h-px bg-gradient-to-r from-toyota-red/30 to-toyota-blue/30" />
      {items.map((item, idx) => (
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
  );
}

export function DashboardCharts() {
  return (
    <section className="space-y-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {/* Chart 1 - Driver Completion Trends (Line Chart) - Full Width */}
        <Card className="group h-[450px] border-0 shadow-lg shadow-slate-900/5 bg-linear-to-br from-white/98 via-white/95 to-indigo-50/20 backdrop-blur-md transition-all duration-300 hover:shadow-xl hover:shadow-slate-900/10 hover:scale-[1.01] transform-gpu border-l-4 border-l-transparent hover:border-l-indigo-400/60 overflow-hidden relative md:col-span-2 xl:col-span-3 flex flex-col">
          <div className="absolute inset-0 bg-linear-to-br from-indigo-50/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-radial from-indigo-100/20 to-transparent rounded-full transform translate-x-16 -translate-y-16" />
          <CardHeader className="pb-4 relative z-10">
            <CardTitle className="text-lg font-bold text-slate-800 group-hover:text-slate-900 transition-colors duration-200 flex items-center gap-2">
              <div className="w-2 h-2 bg-indigo-500 rounded-full group-hover:scale-125 transition-transform duration-200" />
              כמות משימות לפי נהגים{' '}
            </CardTitle>
            <CardDescription className="text-slate-600 group-hover:text-slate-700 transition-colors duration-200 font-medium">
              השוואת כמות ביצוע המשימות בין הנהגים השונים לאורך ציר הזמן
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0 relative z-10 flex flex-col flex-1 min-h-0">
            <DriverCompletionTrendChart />
          </CardContent>
        </Card>

        {/* Chart 2 - Weekly Task Trends (Line Chart) */}
        <Card className="group h-[450px] border-0 shadow-lg shadow-slate-900/5 bg-linear-to-br from-white/98 via-white/95 to-blue-50/20 backdrop-blur-md transition-all duration-300 hover:shadow-xl hover:shadow-slate-900/10 hover:scale-[1.01] transform-gpu border-l-4 border-l-transparent hover:border-l-blue-400/60 overflow-hidden relative">
          <div className="absolute inset-0 bg-linear-to-br from-blue-50/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-radial from-blue-100/20 to-transparent rounded-full transform translate-x-16 -translate-y-16" />
          <CardHeader className="pb-4 relative z-10">
            <CardTitle className="text-lg font-bold text-slate-800 group-hover:text-slate-900 transition-colors duration-200 flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full group-hover:scale-125 transition-transform duration-200" />
              סטטוס ביצוע משימות{' '}
            </CardTitle>
            <CardDescription className="text-slate-600 group-hover:text-slate-700 transition-colors duration-200 font-medium">
              משימות שבוצעו/לא בוצעו{' '}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0 relative z-10 flex flex-col">
            <div className="h-[280px] mb-2">
              <WeeklyTrendsChart />
            </div>
            <ChartLegend
              items={[
                {
                  label: 'סה״כ משימות',
                  color: '#3b82f6',
                },
                { label: 'בוצעו', color: '#10b981' },
                { label: 'לא בוצעו', color: '#f59e0b' },
              ]}
            />
          </CardContent>
        </Card>

        {/* Chart 3 - Driver Task Completion Comparison (Bar Chart) */}
        <Card className="group h-[450px] border-0 shadow-lg shadow-slate-900/5 bg-linear-to-br from-white/98 via-white/95 to-green-50/20 backdrop-blur-md transition-all duration-300 hover:shadow-xl hover:shadow-slate-900/10 hover:scale-[1.01] transform-gpu border-l-4 border-l-transparent hover:border-l-green-400/60 overflow-hidden relative">
          <div className="absolute inset-0 bg-linear-to-br from-green-50/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-radial from-green-100/20 to-transparent rounded-full transform translate-x-16 -translate-y-16" />
          <CardHeader className="pb-4 relative z-10">
            <CardTitle className="text-lg font-bold text-slate-800 group-hover:text-slate-900 transition-colors duration-200 flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full group-hover:scale-125 transition-transform duration-200" />
              ביצוע משימות לפי נהגים
            </CardTitle>
            <CardDescription className="text-slate-600 group-hover:text-slate-700 transition-colors duration-200 font-medium">
              השלמת משימות מול סך הכל משימות שהוקצו לנהג במהלך התקופה הנבחרת
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0 relative z-10 flex flex-col">
            <div className="h-[280px] mb-2">
              <DriverCompletionChart />
            </div>
            <ChartLegend
              items={[
                { label: 'בוצעו', color: '#10b981' },
                { label: 'לא בוצעו', color: '#f59e0b' },
              ]}
            />
          </CardContent>
        </Card>

        {/* Chart 4 - Driver Task Duration Analysis */}
        <Card className="group h-[450px] border-0 shadow-lg shadow-slate-900/5 bg-linear-to-br from-white/98 via-white/95 to-orange-50/20 backdrop-blur-md transition-all duration-300 hover:shadow-xl hover:shadow-slate-900/10 hover:scale-[1.01] transform-gpu border-l-4 border-l-transparent hover:border-l-orange-400/60 overflow-hidden relative">
          <div className="absolute inset-0 bg-linear-to-br from-orange-50/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-radial from-orange-100/20 to-transparent rounded-full transform translate-x-16 -translate-y-16" />
          <CardHeader className="pb-4 relative z-10">
            <CardTitle className="text-lg font-bold text-slate-800 group-hover:text-slate-900 transition-colors duration-200 flex items-center gap-2">
              <div className="w-2 h-2 bg-orange-500 rounded-full group-hover:scale-125 transition-transform duration-200" />
              ממוצע זמן טיפול במשימה
            </CardTitle>
            <CardDescription className="text-slate-600 group-hover:text-slate-700 transition-colors duration-200 font-medium">
              משך משימה ממוצע בדקות לכל נהג
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0 relative z-10 flex flex-col">
            <div className="h-[280px] mb-2">
              <DriverDurationChart />
            </div>
            <ChartLegend
              items={[
                {
                  label: 'משך משימה ממוצע',
                  color: '#f97316',
                },
              ]}
            />
          </CardContent>
        </Card>

        {/* Chart 5 - Status by Priority */}
        {/* <StatusByPriorityChart /> */}

        {/* Chart 6 - Status by Type */}
        <StatusByTypeChart />

        {/* Chart 6.5 - Driver Breaks Analysis */}
        <Card className="group h-[520px] border-0 shadow-lg shadow-slate-900/5 bg-linear-to-br from-white/98 via-white/95 to-indigo-50/20 backdrop-blur-md transition-all duration-300 hover:shadow-xl hover:shadow-slate-900/10 hover:scale-[1.01] transform-gpu border-l-4 border-l-transparent hover:border-l-indigo-400/60 overflow-hidden relative">
          <div className="absolute inset-0 bg-linear-to-br from-indigo-50/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-radial from-indigo-100/20 to-transparent rounded-full transform translate-x-16 -translate-y-16" />
          <CardHeader className="pb-4 relative z-10">
            <CardTitle className="text-lg font-bold text-slate-800 group-hover:text-slate-900 transition-colors duration-200 flex items-center gap-2">
              <div className="w-2 h-2 bg-indigo-500 rounded-full group-hover:scale-125 transition-transform duration-200" />
              הפסקות נהגים
            </CardTitle>
            <CardDescription className="text-slate-600 group-hover:text-slate-700 transition-colors duration-200 font-medium">
              סה״כ זמן הפסקות ומספר הפסקות לפי נהג
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0 relative z-10 flex flex-col h-[calc(100%-88px)]">
             <div className="flex-1 min-h-0">
               <DriverBreaksChart />
             </div>
             <ChartLegend
              items={[
                {
                  label: 'משך הפסקה כולל',
                  color: 'hsl(211.6981 96.3636% 78.4314%)',
                },
              ]}
            />
          </CardContent>
        </Card>

        {/* Chart 7 - Tasks by Driver Type (Full Width) */}
        <div className="md:col-span-2 xl:col-span-3">
          <TasksByDriverTypeChart />
        </div>
      </div>
    </section>
  );
}
