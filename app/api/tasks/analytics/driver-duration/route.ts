import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

interface DriverDurationAgg {
  driver_id: string;
  driver_name: string | null;
  totalDurationMs: number;
  count: number;
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
        'driver_id, assigned_at, tasks(id,status,updated_at,estimated_start), profiles:driver_id(name)'
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

    const byDriver = new Map<string, DriverDurationAgg>();
    let globalDurationMs = 0;
    let globalCount = 0;

    (data || []).forEach((row: any) => {
      const driverId = row.driver_id as string | null;
      const task = row.tasks as {
        status?: string;
        updated_at?: string;
        estimated_start?: string;
      } | null;
      if (!driverId || !task) return;

      if (
        task.status !== 'completed' ||
        !task.updated_at ||
        !task.estimated_start
      ) {
        return;
      }

      const updatedAt = new Date(task.updated_at).getTime();
      const startAt = new Date(task.estimated_start).getTime();
      if (Number.isNaN(updatedAt) || Number.isNaN(startAt)) return;

      if (
        task.updated_at < rangeStart ||
        task.updated_at > rangeEnd
      ) {
        return;
      }

      const durationMs = Math.max(0, updatedAt - startAt);
      if (!Number.isFinite(durationMs) || durationMs <= 0) return;

      const key = driverId;
      const name =
        (row.profiles && (row.profiles.name as string)) || '—';

      const existing =
        byDriver.get(key) || {
          driver_id: key,
          driver_name: name,
          totalDurationMs: 0,
          count: 0,
        };

      existing.totalDurationMs += durationMs;
      existing.count += 1;
      byDriver.set(key, existing);

      globalDurationMs += durationMs;
      globalCount += 1;
    });

    const drivers = Array.from(byDriver.values())
      .map((d) => {
        const avgMinutes =
          d.count === 0
            ? 0
            : Math.round(d.totalDurationMs / d.count / 60000);
        return {
          driverId: d.driver_id,
          driverName: d.driver_name,
          avgDurationMinutes: avgMinutes,
          taskCount: d.count,
        };
      })
      .filter((d) => d.taskCount > 0);

    const globalAverageMinutes =
      globalCount === 0
        ? 0
        : Math.round(globalDurationMs / globalCount / 60000);

    return NextResponse.json(
      { ok: true, drivers, globalAverageMinutes },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || 'internal' },
      { status: 500 }
    );
  }
}


