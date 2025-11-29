import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { TaskStatus, TaskPriority, TaskType } from '@/types/task';

// Consistent Status Colors Mapping (for reference, handled in UI)
// - בהמתנה (pending): #f59e0b
// - בעבודה (in progress): #3b82f6
// - חסומה (blocked): #ef4444
// - הושלמה (completed): #16a34a

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const groupBy = searchParams.get('groupBy'); // 'priority' | 'type'

    if (!from || !to || !groupBy) {
      return NextResponse.json(
        { ok: false, error: 'missing-params' },
        { status: 400 }
      );
    }

    if (groupBy !== 'priority' && groupBy !== 'type') {
      return NextResponse.json(
        { ok: false, error: 'invalid-groupBy' },
        { status: 400 }
      );
    }

    const rangeStart = new Date(from).toISOString();
    const rangeEnd = new Date(to).toISOString();

    const admin = getSupabaseAdmin();

    // Select tasks within range based on created_at or updated_at?
    // Usually dashboards filter by created_at or estimated_start.
    // Existing analytics seem to use estimated_start or created_at depending on metric.
    // Let's use estimated_start to align with "Scheduled Tasks".
    // Or stick to created_at if we want "New tasks".
    // Looking at getScheduledTasksCount in queries.ts, it uses estimated_start.
    // Let's use estimated_start for consistency with the main metrics.

    // Actually, dashboard typically shows workload in that period.
    const { data, error } = await admin
      .from('tasks')
      .select('id, status, priority, type')
      .gte('estimated_start', rangeStart)
      .lt('estimated_start', rangeEnd)
      .limit(10000);

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 400 }
      );
    }

    // Initialize result structure
    // Key: Priority/Type, Value: Record<Status, count>
    const result: Record<string, Record<TaskStatus, number>> = {};

    (data || []).forEach((task) => {
      const groupKey = groupBy === 'priority' ? task.priority : task.type;
      const status = task.status as TaskStatus;

      if (!groupKey || !status) return;

      if (!result[groupKey]) {
        result[groupKey] = {
            'בהמתנה': 0,
            'בעבודה': 0,
            'חסומה': 0,
            'הושלמה': 0
        };
      }
      
      if (result[groupKey][status] !== undefined) {
        result[groupKey][status]++;
      }
    });

    return NextResponse.json({ ok: true, data: result }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || 'internal' },
      { status: 500 }
    );
  }
}

