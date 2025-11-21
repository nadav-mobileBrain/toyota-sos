import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { fetchDashboardData } from '@/lib/dashboard/queries';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const tz = searchParams.get('tz') || 'UTC';

    if (!from || !to) {
      return NextResponse.json({ error: 'missing-range' }, { status: 400 });
    }
    const range = {
      start: new Date(from).toISOString(),
      end: new Date(to).toISOString(),
      timezone: tz,
    };
    const admin = getSupabaseAdmin();
    const data = await fetchDashboardData(range, admin);
    return NextResponse.json({ ok: true, data }, { status: 200 });
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'internal' },
      { status: 500 }
    );
  }
}
