import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

interface TaskTypeCount {
  taskType: string;
  count: number;
}

interface DriverTaskTypeRow {
  driver_id: string;
  driver_name: string | null;
  task_type: string;
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

    // Query tasks completed in the range, grouped by driver and task type
    // First get all completed tasks in the range
    const { data: tasksData, error: tasksError } = await admin
      .from('tasks')
      .select('id, type, updated_at')
      .eq('status', 'הושלמה')
      .gte('updated_at', rangeStart)
      .lt('updated_at', rangeEnd)
      .limit(10000);

    if (tasksError) {
      return NextResponse.json(
        { ok: false, error: tasksError.message },
        { status: 400 }
      );
    }

    if (!tasksData || tasksData.length === 0) {
      return NextResponse.json({ ok: true, drivers: [] }, { status: 200 });
    }

    const taskIds = tasksData.map((t) => t.id);

    // Get task assignees for these tasks
    const { data: assigneesData, error: assigneesError } = await admin
      .from('task_assignees')
      .select('driver_id, task_id, profiles:driver_id(name,employee_id)')
      .eq('is_lead', true)
      .in('task_id', taskIds)
      .limit(10000);

    if (assigneesError) {
      return NextResponse.json(
        { ok: false, error: assigneesError.message },
        { status: 400 }
      );
    }

    // Create a map of task_id -> task type
    const taskTypeMap = new Map<string, string>();
    tasksData.forEach((task) => {
      if (task.type) {
        taskTypeMap.set(task.id, task.type);
      }
    });

    // Group by driver and task type
    const byDriver = new Map<
      string,
      { name: string; types: Map<string, number> }
    >();

    (assigneesData || []).forEach((row: any) => {
      const driverId = row.driver_id as string | null;
      const taskId = row.task_id as string | null;
      const profiles = row.profiles;
      const profileArray = Array.isArray(profiles)
        ? profiles
        : profiles
        ? [profiles]
        : [];
      const profile = profileArray[0] as { name?: string; employee_id?: string } | null;

      if (!driverId || !taskId) return;

      const taskType = taskTypeMap.get(taskId);
      if (!taskType) return;

      const driverName = profile?.name || '—';
      const employeeId = profile?.employee_id || driverId;

      const driver = byDriver.get(employeeId) || {
        name: driverName,
        types: new Map<string, number>(),
      };

      const currentCount = driver.types.get(taskType) || 0;
      driver.types.set(taskType, currentCount + 1);
      byDriver.set(employeeId, driver);
    });

    // Convert to array format
    const result: Array<{
      driverId: string;
      driverName: string;
      taskTypes: TaskTypeCount[];
      total: number;
    }> = Array.from(byDriver.entries()).map(([driverId, driver]) => {
      const taskTypes: TaskTypeCount[] = Array.from(
        driver.types.entries()
      ).map(([taskType, count]) => ({
        taskType,
        count,
      }));

      const total = taskTypes.reduce((sum, tt) => sum + tt.count, 0);

      return {
        driverId,
        driverName: driver.name,
        taskTypes,
        total,
      };
    });

    // Sort by total descending
    result.sort((a, b) => b.total - a.total);

    return NextResponse.json({ ok: true, drivers: result }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || 'internal' },
      { status: 500 }
    );
  }
}

