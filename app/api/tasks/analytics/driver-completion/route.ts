import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

interface DriverCompletionRow {
  driver_id: string;
  driver_name: string | null;
  completed: number;
  total: number;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    if (!from || !to) {
      return NextResponse.json(
        { ok: false, error: 'missing-range' },
        { status: 400 }
      );
    }

    const rangeStart = new Date(from).toISOString();
    const rangeEnd = new Date(to).toISOString();

    const admin = getSupabaseAdmin();

    const { data, error } = await admin
      .from('task_assignees')
      .select(
        'driver_id, assigned_at, tasks(id,status,updated_at), profiles:driver_id(name)'
      )
      .eq('is_lead', true)
      .gte('assigned_at', rangeStart)
      .lt('assigned_at', rangeEnd)
      .limit(5000);

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 400 }
      );
    }

    const byDriver = new Map<string, DriverCompletionRow>();

    (data || []).forEach((row: any) => {
      const driverId = row.driver_id as string | null;
      const task = row.tasks as { status?: string; updated_at?: string } | null;
      if (!driverId || !task) return;

      const key = driverId;
      const name =
        (row.profiles && (row.profiles.name as string)) || '—';

      const existing =
        byDriver.get(key) || {
          driver_id: key,
          driver_name: name,
          completed: 0,
          total: 0,
        };

      existing.total += 1;

      if (
        task.status === 'completed' &&
        task.updated_at &&
        new Date(task.updated_at).toISOString() >= rangeStart &&
        new Date(task.updated_at).toISOString() <= rangeEnd
      ) {
        existing.completed += 1;
      }

      byDriver.set(key, existing);
    });

    const drivers = Array.from(byDriver.values())
      .map((d) => {
        const completionRate =
          d.total === 0 ? 0 : Math.round((d.completed / d.total) * 100);
        return {
          driverId: d.driver_id,
          driverName: d.driver_name,
          completionRate,
          completed: d.completed,
          total: d.total,
        };
      })
      .filter((d) => d.total > 0);

    return NextResponse.json({ ok: true, drivers }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || 'internal' },
      { status: 500 }
    );
  }
}


