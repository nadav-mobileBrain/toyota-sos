'use client';
import { WeeklyTrendsChart } from '@/components/admin/dashboard/charts/WeeklyTrendsChart';
import { DriverCompletionChart } from '@/components/admin/dashboard/charts/DriverCompletionChart';
import { DriverDurationChart } from '@/components/admin/dashboard/charts/DriverDurationChart';

export function DashboardCharts() {
  return (
    <section className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Chart 1 - Weekly Task Trends (Line Chart) */}
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">
            מגמת משימות שבועית
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            קו המציג משימות שהושלמו, לא הושלמו ומשימות באיחור לאורך השבוע.
          </p>
          <WeeklyTrendsChart />
        </div>

        {/* Chart 2 - Driver Task Completion Comparison (Bar Chart) */}
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">
            השוואת השלמת משימות לפי נהג
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            אחוז השלמת משימות לכל נהג, כולל אפשרות למיון לפי ביצועים.
          </p>
          <DriverCompletionChart />
        </div>

        {/* Chart 3 - Driver Task Duration Analysis */}
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">
            ניתוח זמני טיפול במשימות לפי נהג
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            משך משימה ממוצע בדקות לכל נהג, עם אפשרות לפירוק לפי סוג משימה.
          </p>
          <DriverDurationChart />
        </div>
      </div>
    </section>
  );
}
