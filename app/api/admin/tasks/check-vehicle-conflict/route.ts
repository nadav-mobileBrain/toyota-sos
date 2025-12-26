import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

// Disable caching for API routes
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/admin/tasks/check-vehicle-conflict
 * Check if a vehicle is already assigned to another task on the same day with overlapping time
 * Query params: vehicle_id, estimated_start, estimated_end, task_id (optional, to exclude current task when editing)
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const roleCookie = cookieStore.get('toyota_role')?.value;
    if (
      !roleCookie ||
      (roleCookie !== 'admin' && roleCookie !== 'manager' && roleCookie !== 'viewer')
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const vehicleId = searchParams.get('vehicle_id');
    const estimatedStart = searchParams.get('estimated_start');
    const estimatedEnd = searchParams.get('estimated_end');
    const taskId = searchParams.get('task_id'); // Optional: exclude current task when editing

    if (!vehicleId || !estimatedStart || !estimatedEnd) {
      return NextResponse.json(
        { error: 'Missing required parameters: vehicle_id, estimated_start, estimated_end' },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();

    // Parse dates
    const startDate = new Date(estimatedStart);
    const endDate = new Date(estimatedEnd);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format' },
        { status: 400 }
      );
    }

    // Check for overlapping tasks with the same vehicle
    // Two time ranges overlap if: start1 < end2 AND start2 < end1
    // Also check that they're on the same day
    let query = admin
      .from('tasks')
      .select('id, title, type, estimated_start, estimated_end, status')
      .eq('vehicle_id', vehicleId)
      .not('status', 'eq', 'הושלמה') // Only check non-completed tasks
      .lt('estimated_start', estimatedEnd)
      .gt('estimated_end', estimatedStart);

    // Exclude current task if editing
    if (taskId) {
      query = query.neq('id', taskId);
    }

    const { data: conflictingTasks, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // Filter to same day and verify overlap
    const sameDayConflicts = (conflictingTasks || []).filter((task) => {
      if (!task.estimated_start || !task.estimated_end) return false;

      const taskStart = new Date(task.estimated_start);
      const taskEnd = new Date(task.estimated_end);

      // Check if same day (compare dates only, ignoring time)
      const startDay = startDate.toDateString();
      const taskStartDay = taskStart.toDateString();
      if (startDay !== taskStartDay) return false;

      // Verify overlap: start1 < end2 AND start2 < end1
      return startDate < taskEnd && taskStart < endDate;
    });

    return NextResponse.json(
      {
        hasConflict: sameDayConflicts.length > 0,
        conflictingTasks: sameDayConflicts,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    );
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

