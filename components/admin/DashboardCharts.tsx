'use client';

import dynamic from 'next/dynamic';

const WeeklyTrendsChart = dynamic(
  () =>
    import('@/components/admin/dashboard/charts/WeeklyTrendsChart').then(
      (mod) => ({ default: mod.WeeklyTrendsChart })
    ),
  { ssr: false }
);

const DriverCompletionChart = dynamic(
  () =>
    import('@/components/admin/dashboard/charts/DriverCompletionChart').then(
      (mod) => ({ default: mod.DriverCompletionChart })
    ),
  { ssr: false }
);

const DriverDurationChart = dynamic(
  () =>
    import('@/components/admin/dashboard/charts/DriverDurationChart').then(
      (mod) => ({ default: mod.DriverDurationChart })
    ),
  { ssr: false }
);

const StatusByPriorityChart = dynamic(
  () =>
    import('@/components/admin/dashboard/charts/StatusByPriorityChart').then(
      (mod) => ({ default: mod.StatusByPriorityChart })
    ),
  { ssr: false }
);

const StatusByTypeChart = dynamic(
  () =>
    import('@/components/admin/dashboard/charts/StatusByTypeChart').then(
      (mod) => ({ default: mod.StatusByTypeChart })
    ),
  { ssr: false }
);

function ChartLegend({
  items,
}: {
  items: Array<{ label: string; color: string }>;
}) {
  return (
    <div className="mt-2 flex flex-wrap items-center justify-center gap-3 text-xs">
      {items.map((item, idx) => (
        <div key={idx} className="flex items-center gap-1.5">
          <div
            className="h-2.5 w-2.5 rounded-full border border-gray-300"
            style={{ backgroundColor: item.color }}
          />
          <span className="text-gray-600">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

export function DashboardCharts() {
  return (
    <section className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Chart 1 - Weekly Task Trends (Line Chart) */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-all duration-200 hover:shadow-lg">
          <h2 className="text-sm font-semibold text-gray-900">מגמת משימות</h2>

          <WeeklyTrendsChart />
          <ChartLegend
            items={[
              {
                label: 'סה״כ משימות',
                color: 'hsl(221.2121 83.1933% 53.3333%)',
              },
              { label: 'הושלמו', color: 'hsl(213.1169 93.9024% 67.8431%)' },
              { label: 'לא הושלמו', color: 'hsl(211.6981 96.3636% 78.4314%)' },
              { label: 'באיחור', color: 'hsl(213.3333 96.9231% 87.2549%)' },
            ]}
          />
        </div>

        {/* Chart 2 - Driver Task Completion Comparison (Bar Chart) */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-all duration-200 hover:shadow-lg">
          <h2 className="text-sm font-semibold text-gray-900">
            ביצוע משימות לפי נהגים
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            השלמת משימות מול סך הכל משימות שהוקצו לנהג.
          </p>
          <DriverCompletionChart />
          <ChartLegend
            items={[
              { label: 'הושלמו', color: 'hsl(213.1169 93.9024% 67.8431%)' },
              { label: 'לא הושלמו', color: '#9ca3af' },
            ]}
          />
        </div>

        {/* Chart 3 - Driver Task Duration  Analysis */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-all duration-200 hover:shadow-lg">
          <h2 className="text-sm font-semibold text-gray-900">
            ממוצע זמן טיפול במשימה לנהג{' '}
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            משך משימה ממוצע בדקות לכל נהג, עם אפשרות לפירוק לפי סוג משימה.
          </p>
          <DriverDurationChart />
          <ChartLegend
            items={[
              {
                label: 'משך משימה ממוצע',
                color: 'hsl(211.6981 96.3636% 78.4314%)',
              },
            ]}
          />
        </div>

        {/* Chart 4 - Status by Priority */}
        <StatusByPriorityChart />

        {/* Chart 5 - Status by Type */}
        <StatusByTypeChart />
      </div>
    </section>
  );
}
