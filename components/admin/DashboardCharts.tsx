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
        <div className="rounded-xl border-2 border-primary bg-white p-4 shadow-md transition-all duration-200 hover:border-primary/50 hover:shadow-lg">
          <h2 className="text-sm font-semibold text-gray-900">
            מגמת משימות שבועית
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            קו המציג משימות שהושלמו, לא הושלמו ומשימות באיחור לאורך השבוע.
          </p>
          <WeeklyTrendsChart />
          <ChartLegend
            items={[
              { label: 'הושלמו', color: '#16a34a' },
              { label: 'לא הושלמו', color: '#f97316' },
              { label: 'באיחור', color: '#ef4444' },
            ]}
          />
        </div>

        {/* Chart 2 - Driver Task Completion Comparison (Bar Chart) */}
        <div className="rounded-xl border-2 border-primary bg-white p-4 shadow-md transition-all duration-200 hover:border-primary/50 hover:shadow-lg">
          <h2 className="text-sm font-semibold text-gray-900">
            השוואת השלמת משימות לפי נהג
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            אחוז השלמת משימות לכל נהג, כולל אפשרות למיון לפי ביצועים.
          </p>
          <DriverCompletionChart />
          <ChartLegend
            items={[
              { label: 'מעל 80%', color: '#16a34a' },
              { label: '60%-80%', color: '#eab308' },
              { label: 'מתחת ל-60%', color: '#ef4444' },
            ]}
          />
        </div>

        {/* Chart 3 - Driver Task Duration  Analysis */}
        <div className="rounded-xl border-2 border-primary bg-white p-4 shadow-md transition-all duration-200 hover:border-primary/50 hover:shadow-lg">
          <h2 className="text-sm font-semibold text-gray-900">
            ניתוח זמני טיפול במשימות לפי נהג
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            משך משימה ממוצע בדקות לכל נהג, עם אפשרות לפירוק לפי סוג משימה.
          </p>
          <DriverDurationChart />
          <ChartLegend
            items={[{ label: 'משך משימה ממוצע', color: '#0ea5e9' }]}
          />
        </div>
      </div>
    </section>
  );
}
