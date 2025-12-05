import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import {
  fetchDashboardData,
  fetchDashboardDataWithTrends,
  clearCacheForRange,
} from '@/lib/dashboard/queries';
import { calculatePreviousPeriod } from '@/lib/dashboard/period-utils';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const tz = searchParams.get('tz') || 'UTC';
    const withTrends = searchParams.get('trends') === 'true';
    const cacheBust = searchParams.get('_t'); // Cache-busting parameter from realtime

    if (!from || !to) {
      return NextResponse.json({ error: 'missing-range' }, { status: 400 });
    }

    const currentRange = {
      start: new Date(from).toISOString(),
      end: new Date(to).toISOString(),
      timezone: tz,
    };

    const admin = getSupabaseAdmin();

    // If cache-busting parameter is present (from realtime), clear cache for this range
    if (cacheBust) {
      clearCacheForRange(currentRange);
    }

    let data;

    if (withTrends) {
      // Calculate previous period for trend comparison
      const previousRange = calculatePreviousPeriod(currentRange);

      // Clear cache for previous range as well if cache busting
      if (cacheBust) {
        clearCacheForRange(previousRange);
      }

      data = await fetchDashboardDataWithTrends(currentRange, previousRange, admin);
    } else {
      data = await fetchDashboardData(currentRange, admin);
    }

    return NextResponse.json({ ok: true, data }, { status: 200 });
  } catch (e: unknown) {
    console.error('Dashboard summary error:', e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'internal' },
      { status: 500 }
    );
  }
}
