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
        <div className="group relative rounded-xl p-[3px] bg-gradient-to-br from-blue-500/20 via-purple-500/20 to-pink-500/20 shadow-sm transition-all duration-300 hover:from-blue-500/30 hover:via-purple-500/30 hover:to-pink-500/30 hover:shadow-md">
          {/* Gradient border effect */}
          <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-blue-500/0 via-purple-500/0 to-pink-500/0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

          {/* Inner card */}
          <div className="relative h-full rounded-[11px] bg-white p-4">
            {/* Subtle gradient overlay */}
            <div className="absolute inset-0 rounded-[11px] bg-gradient-to-br from-gray-50/30 via-transparent to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />

            <div className="relative ">
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
          </div>
        </div>

        {/* Chart 2 - Driver Task Completion Comparison (Bar Chart) */}
        <div className="group relative rounded-xl p-[3px] bg-gradient-to-br from-blue-500/20 via-purple-500/20 to-pink-500/20 shadow-sm transition-all duration-300 hover:from-blue-500/30 hover:via-purple-500/30 hover:to-pink-500/30 hover:shadow-md">
          {/* Gradient border effect */}
          <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-blue-500/0 via-purple-500/0 to-pink-500/0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

          {/* Inner card */}
          <div className="relative h-full rounded-[11px] bg-white p-4">
            {/* Subtle gradient overlay */}
            <div className="absolute inset-0 rounded-[11px] bg-gradient-to-br from-gray-50/30 via-transparent to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />

            <div className="relative">
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
          </div>
        </div>

        {/* Chart 3 - Driver Task Duration Analysis */}
        <div className="group relative rounded-xl p-[3px] bg-gradient-to-br from-blue-500/20 via-purple-500/20 to-pink-500/20 shadow-sm transition-all duration-300 hover:from-blue-500/30 hover:via-purple-500/30 hover:to-pink-500/30 hover:shadow-md">
          {/* Gradient border effect */}
          <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-blue-500/0 via-purple-500/0 to-pink-500/0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

          {/* Inner card */}
          <div className="relative h-full rounded-[11px] bg-white p-4">
            {/* Subtle gradient overlay */}
            <div className="absolute inset-0 rounded-[11px] bg-gradient-to-br from-gray-50/30 via-transparent to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />

            <div className="relative">
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
        </div>
      </div>
    </section>
  );
}
