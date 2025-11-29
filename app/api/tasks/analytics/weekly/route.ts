import { NextResponse } from 'next/server';
import { fetchDashboardData, type DateRange } from '@/lib/dashboard/queries';

function normalizeRange(searchParams: URLSearchParams): DateRange {
  const now = new Date();
  const end = searchParams.get('to')
    ? new Date(searchParams.get('to') as string)
    : now;
  const start = searchParams.get('from')
    ? new Date(searchParams.get('from') as string)
    : new Date(end.getTime() - 6 * 24 * 60 * 60 * 1000);

  return {
    start: start.toISOString(),
    end: end.toISOString(),
    timezone: searchParams.get('tz') || 'UTC',
  };
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const range = normalizeRange(url.searchParams);
    const data = await fetchDashboardData(range);

    const byDate = new Map<
      string,
      { completed: number; notCompleted: number; overdue: number; total: number }
    >();

    data.datasets.createdCompletedSeries.forEach((p) => {
      const existing = byDate.get(p.date) || {
        completed: 0,
        notCompleted: 0,
        overdue: 0,
        total: 0,
      };
      existing.completed += p.completed;
      const open = Math.max(p.created - p.completed, 0);
      existing.notCompleted += open;
      existing.total += p.created;
      byDate.set(p.date, existing);
    });

    const overdueTotal = data.datasets.overdueByDriver.reduce(
      (acc, p) => acc + p.overdue,
      0
    );
    if (overdueTotal > 0) {
      const lastKey = data.datasets.createdCompletedSeries.at(-1)?.date;
      if (lastKey) {
        const existing = byDate.get(lastKey) || {
          completed: 0,
          notCompleted: 0,
          overdue: 0,
          total: 0,
        };
        existing.overdue += overdueTotal;
        // Should overdue affect total? Probably not if total is "created".
        // But if total means "Total Active", then yes.
        // Assuming user means "Total Created/Scheduled" for the day.
        byDate.set(lastKey, existing);
      }
    }

    const points = Array.from(byDate.entries())
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([date, v]) => ({
        date,
        completed: v.completed,
        notCompleted: v.notCompleted,
        overdue: v.overdue,
        total: v.total,
      }));

    return NextResponse.json({ ok: true, points });
  } catch (e) {
    console.error('weekly analytics error', e);
    return NextResponse.json(
      { ok: false, error: 'failed to load weekly analytics' },
      { status: 500 }
    );
  }
}


