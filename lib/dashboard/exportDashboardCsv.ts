import { toCsv, downloadCsv, makeCsvFilename } from '@/utils/csv';
import type {
  DashboardDataWithTrends,
  CreatedCompletedPoint,
  OverdueByDriverPoint,
  FunnelStep,
} from '@/lib/dashboard/queries';
import type { PeriodRange } from '@/components/admin/dashboard/PeriodContext';

interface WeeklyPoint {
  date: string;
  completed: number;
  notCompleted: number;
  overdue: number;
  total: number;
}

interface DriverCompletionRow {
  driverId: string;
  driverName: string;
  completionRate: number;
  completed: number;
  total: number;
}

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

interface DriverDurationRow {
  driverId: string;
  driverName: string;
  avgDurationMinutes: number;
  taskCount: number;
}

interface DriverBreakRow {
  driver_id: string;
  driver_name: string;
  totalDurationMinutes: number;
  count: number;
}

interface TaskTypeCount {
  taskType: string;
  count: number;
}

interface DriverTaskTypeRow {
  driverId: string;
  driverName: string;
  taskTypes: TaskTypeCount[];
  total: number;
}

// RTL Mark for Hebrew text direction
const RLM = '\u200F';
// Right-to-Left Embedding for Excel/Google Sheets
const RLE = '\u202B';

// Helper to fetch json safely
async function fetchJson(url: string) {
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(await r.text());
    const j = await r.json();
    if (!j.ok) throw new Error(j.error || 'failed');
    return j;
  } catch (e) {
    console.error(`Failed to fetch ${url}`, e);
    return null;
  }
}

export async function exportDashboardCsv(
  data: DashboardDataWithTrends,
  range: PeriodRange
): Promise<void> {
  const secs: string[] = [];
  const bom = '\uFEFF';
  
  secs.push('');

  // 1. Summary section (Hebrew headers with RTL)
  const summaryHeaders = ['מדד', 'ערך'];
  const summaryRows = [
    { מדד: 'משימות מתוכננות', ערך: data.summary.scheduledTasks },
    { מדד: 'משימות שהושלמו', ערך: data.summary.completedTasks },
    { מדד: 'הושלמו באיחור', ערך: data.summary.completedLate },
    { מדד: 'הושלמו בזמן', ערך: data.summary.completedOnTime },
    { מדד: 'חריגות SLA', ערך: data.summary.slaViolations },
    {
      מדד: 'ניצולת נהגים (%)',
      ערך: data.summary.driverUtilizationPct,
    },
    { מדד: 'נהגים פעילים', ערך: data.summary.activeDrivers },
  ];
  // Reverse headers for RTL (rightmost column first)
  const summaryCsv =
    (toCsv(summaryRows, [...summaryHeaders].reverse()) || '').slice(1);
  secs.push(`${RLM}חלק,סיכום`);
  secs.push(summaryCsv);

  // 2. Created/Completed time series
  const seriesHeaders = ['תאריך', 'נוצרו', 'הושלמו'];
  const seriesRows = data.datasets.createdCompletedSeries.map(
    (p: CreatedCompletedPoint) => ({
      תאריך: p.date,
      נוצרו: p.created,
      הושלמו: p.completed,
    })
  );
  const seriesCsv =
    (toCsv(seriesRows, [...seriesHeaders].reverse()) || '').slice(1);
  secs.push('');
  secs.push(`${RLM}חלק,סדרת זמן נוצרו/הושלמו`);
  secs.push(seriesCsv);

  // 3. Overdue by driver
  const overdueHeaders = ['מזהה נהג', 'שם נהג', 'באיחור'];
  const overdueRows = data.datasets.overdueByDriver.map(
    (p: OverdueByDriverPoint) => ({
      'מזהה נהג': p.employee_id || p.driver_id,
      'שם נהג': p.driver_name,
      באיחור: p.overdue,
    })
  );
  const overdueCsv =
    (toCsv(overdueRows, [...overdueHeaders].reverse()) || '').slice(1);
  secs.push('');
  secs.push(`${RLM}חלק,באיחור לפי נהג`);
  secs.push(overdueCsv);

  // 4. OnTime vs Late
  const otHeaders = ['תווית', 'כמות'];
  const otRows = [
    { תווית: 'בזמן', כמות: data.datasets.onTimeVsLate.onTime },
    { תווית: 'באיחור', כמות: data.datasets.onTimeVsLate.late },
  ];
  const otCsv = (toCsv(otRows, [...otHeaders].reverse()) || '').slice(1);
  secs.push('');
  secs.push(`${RLM}חלק,בזמן מול באיחור`);
  secs.push(otCsv);

  // 5. Funnel
  const funnelHeaders = ['שלב', 'כמות'];
  const funnelRows = data.datasets.funnel.map((p: FunnelStep) => ({
    שלב:
      p.step === 'assigned'
        ? 'הוקצו'
        : p.step === 'started'
        ? 'התחילו'
        : 'הושלמו',
    כמות: p.count,
  }));
  const funnelCsv =
    (toCsv(funnelRows, [...funnelHeaders].reverse()) || '').slice(1);
  secs.push('');
  secs.push(`${RLM}חלק,משפך (Funnel)`);
  secs.push(funnelCsv);

  // Fetch additional chart data in parallel
  const baseUrl = window.location.origin;
  const baseParams = new URLSearchParams({
    from: range.start,
    to: range.end,
  });
  if (range.timezone) baseParams.set('tz', range.timezone);

  // Prepare URLs
  const uWeekly = new URL('/api/tasks/analytics/weekly', baseUrl);
  uWeekly.search = baseParams.toString();

  const uDriverCompletion = new URL(
    '/api/tasks/analytics/driver-completion',
    baseUrl
  );
  uDriverCompletion.search = baseParams.toString();

  const uDriverTimeline = new URL(
    '/api/tasks/analytics/driver-completion-timeline',
    baseUrl
  );
  uDriverTimeline.search = baseParams.toString();

  const uDriverDuration = new URL(
    '/api/tasks/analytics/driver-duration',
    baseUrl
  );
  uDriverDuration.search = baseParams.toString();

  const uStatusByType = new URL(
    '/api/tasks/analytics/status-breakdown',
    baseUrl
  );
  uStatusByType.search = baseParams.toString();
  uStatusByType.searchParams.set('groupBy', 'type');

  const uDriverBreaks = new URL('/api/drivers/analytics/breaks', baseUrl);
  uDriverBreaks.search = baseParams.toString();

  const uTasksByType = new URL(
    '/api/tasks/analytics/tasks-by-driver-type',
    baseUrl
  );
  uTasksByType.search = baseParams.toString();

  const [
    weeklyRes,
    driverCompRes,
    driverTimelineRes,
    driverDurRes,
    statusTypeRes,
    driverBreaksRes,
    tasksByTypeRes,
  ] = await Promise.allSettled([
    fetchJson(uWeekly.toString()),
    fetchJson(uDriverCompletion.toString()),
    fetchJson(uDriverTimeline.toString()),
    fetchJson(uDriverDuration.toString()),
    fetchJson(uStatusByType.toString()),
    fetchJson(uDriverBreaks.toString()),
    fetchJson(uTasksByType.toString()),
  ]);

  // 6. Weekly Trends
  if (weeklyRes.status === 'fulfilled' && weeklyRes.value?.points) {
    const points = weeklyRes.value.points as WeeklyPoint[];
    const headers = ['תאריך', 'בוצעו', 'לא בוצעו', 'באיחור', 'סה״כ משימות'];
    const rows = points.map((p) => ({
      תאריך: p.date,
      בוצעו: p.completed,
      'לא בוצעו': p.notCompleted,
      באיחור: p.overdue,
      'סה״כ משימות': p.total,
    }));
    const csv = (toCsv(rows, [...headers].reverse()) || '').slice(1);
    secs.push('');
    secs.push(`${RLM}חלק,מגמות שבועיות`);
    secs.push(csv);
  }

  // 7. Driver Completion
  if (driverCompRes.status === 'fulfilled' && driverCompRes.value?.drivers) {
    const drivers = driverCompRes.value.drivers as DriverCompletionRow[];
    const headers = ['מזהה נהג', 'שם נהג', 'אחוז השלמה', 'בוצעו', 'סה״כ'];
    const rows = drivers.map((d) => ({
      'מזהה נהג': d.driverId,
      'שם נהג': d.driverName,
      'אחוז השלמה': d.completionRate + '%',
      בוצעו: d.completed,
      'סה״כ': d.total,
    }));
    const csv = (toCsv(rows, [...headers].reverse()) || '').slice(1);
    secs.push('');
    secs.push(`${RLM}חלק,ביצוע לפי נהגים`);
    secs.push(csv);
  }

  // 8. Driver Completion Timeline (Trend)
  if (
    driverTimelineRes.status === 'fulfilled' &&
    driverTimelineRes.value?.timeline
  ) {
    const timeline = driverTimelineRes.value.timeline as TimelinePoint[];
    const headers = ['תאריך', 'מזהה נהג', 'שם נהג', 'בוצעו'];
    const rows: Record<string, string | number>[] = [];
    timeline.forEach((pt) => {
      Object.entries(pt.drivers).forEach(([dId, dInfo]) => {
        rows.push({
          תאריך: pt.date,
          'מזהה נהג': dId,
          'שם נהג': dInfo.name,
          בוצעו: dInfo.completed,
        });
      });
    });
    const csv = (toCsv(rows, [...headers].reverse()) || '').slice(1);
    secs.push('');
    secs.push(`${RLM}חלק,מגמת ביצוע לפי נהגים`);
    secs.push(csv);
  }

  // 9. Driver Duration
  if (driverDurRes.status === 'fulfilled' && driverDurRes.value?.drivers) {
    const drivers = driverDurRes.value.drivers as DriverDurationRow[];
    const headers = [
      'מזהה נהג',
      'שם נהג',
      'ממוצע זמן (דקות)',
      'מספר משימות',
    ];
    const rows = drivers.map((d) => ({
      'מזהה נהג': d.driverId,
      'שם נהג': d.driverName,
      'ממוצע זמן (דקות)': d.avgDurationMinutes,
      'מספר משימות': d.taskCount,
    }));
    const csv = (toCsv(rows, [...headers].reverse()) || '').slice(1);
    secs.push('');
    secs.push(`${RLM}חלק,ממוצע זמן טיפול`);
    secs.push(csv);
  }

  // 10. Status by Type
  if (statusTypeRes.status === 'fulfilled' && statusTypeRes.value?.data) {
    const dataMap = statusTypeRes.value.data as Record<
      string,
      Record<string, number>
    >;
    const headers = [
      'סוג משימה',
      'בהמתנה',
      'בעבודה',
      'חסומה',
      'הושלמה',
      'סה״כ',
    ];
    const rows = Object.entries(dataMap).map(([type, counts]) => {
      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      return {
        'סוג משימה': type,
        בהמתנה: counts['בהמתנה'] || 0,
        בעבודה: counts['בעבודה'] || 0,
        חסומה: counts['חסומה'] || 0,
        הושלמה: counts['הושלמה'] || 0,
        'סה״כ': total,
      };
    });
    const csv = (toCsv(rows, [...headers].reverse()) || '').slice(1);
    secs.push('');
    secs.push(`${RLM}חלק,סטטוס לפי סוג`);
    secs.push(csv);
  }

  // 11. Driver Breaks
  if (driverBreaksRes.status === 'fulfilled' && driverBreaksRes.value?.data) {
    const data = driverBreaksRes.value.data as DriverBreakRow[];
    const headers = ['מזהה נהג', 'שם נהג', 'משך כולל (דקות)', 'מספר הפסקות'];
    const rows = data.map((d) => ({
      'מזהה נהג': d.driver_id,
      'שם נהג': d.driver_name,
      'משך כולל (דקות)': d.totalDurationMinutes,
      'מספר הפסקות': d.count,
    }));
    const csv = (toCsv(rows, [...headers].reverse()) || '').slice(1);
    secs.push('');
    secs.push(`${RLM}חלק,הפסקות נהגים`);
    secs.push(csv);
  }

  // 12. Tasks by Driver Type
  if (
    tasksByTypeRes.status === 'fulfilled' &&
    tasksByTypeRes.value?.drivers
  ) {
    const drivers = tasksByTypeRes.value.drivers as DriverTaskTypeRow[];
    const headers = ['מזהה נהג', 'שם נהג', 'סוג משימה', 'כמות', 'סה״כ'];
    const rows: Record<string, string | number>[] = [];
    drivers.forEach((d) => {
      d.taskTypes.forEach((tt) => {
        rows.push({
          'מזהה נהג': d.driverId,
          'שם נהג': d.driverName,
          'סוג משימה': tt.taskType,
          כמות: tt.count,
          'סה״כ': d.total,
        });
      });
    });
    const csv = (toCsv(rows, [...headers].reverse()) || '').slice(1);
    secs.push('');
    secs.push(`${RLM}חלק,משימות לפי סוג נהג`);
    secs.push(csv);
  }

  const joined = bom + secs.join('\n');
  downloadCsv(
    makeCsvFilename('dashboard_full_report', range.timezone),
    joined
  );
}
