import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

interface TimelinePoint {
  date: string; // YYYY-MM-DD
  drivers: Record<
    string,
    {
      name: string;
      completed: number;
    }
  >;
}

function toYMD(dateIso: string): string {
  try {
    const d = new Date(dateIso);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  } catch {
    return dateIso.slice(0, 10);
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    // console.log('Driver Timeline Request:', { from, to });

    if (!from || !to) {
      return NextResponse.json(
        { ok: false, error: 'missing-range' },
        { status: 400 }
      );
    }

    const rangeStart = new Date(from).toISOString();
    const rangeEnd = new Date(to).toISOString();

    const admin = getSupabaseAdmin();

    // Query completed tasks with driver assignments
    // Using !inner on tasks to filter by task properties at DB level
    const { data, error } = await admin
      .from('task_assignees')
      .select(
        'driver_id, tasks!inner(id, status, updated_at), profiles:driver_id(name,employee_id)'
      )
      .eq('is_lead', true)
      .eq('tasks.status', 'הושלמה')
      .gte('tasks.updated_at', rangeStart)
      .lt('tasks.updated_at', rangeEnd)
      .limit(10000);

    if (error) {
      console.error('Error fetching driver timeline:', error);
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 400 }
      );
    }

    // console.log(`Driver Timeline: Found ${data?.length || 0} rows`);

    // Group by date and driver
    const byDate = new Map<
      string,
      Map<string, { name: string; completed: number }>
    >();

    (data || []).forEach((row: any) => {
      const driverId = row.driver_id as string | null;
      const tasks = row.tasks;
      
      if (!driverId || !tasks) return;

      const task = Array.isArray(tasks) ? tasks[0] : tasks;
      if (!task || !task.updated_at) return;

      const date = toYMD(task.updated_at);
      const profiles = row.profiles;
      const profileArray = Array.isArray(profiles)
        ? profiles
        : profiles
        ? [profiles]
        : [];
      const driverName = (profileArray[0]?.name as string) || '—';
      const employeeId = (profileArray[0]?.employee_id as string) || driverId;

      // Get or create date entry
      let dateMap = byDate.get(date);
      if (!dateMap) {
        dateMap = new Map();
        byDate.set(date, dateMap);
      }

      // Use employee_id as key if available, otherwise driver_id
      const driverKey = employeeId;

      // Get or create driver entry for this date
      let driverEntry = dateMap.get(driverKey);
      if (!driverEntry) {
        driverEntry = { name: driverName, completed: 0 };
        dateMap.set(driverKey, driverEntry);
      }

      driverEntry.completed += 1;
    });

    // Convert to timeline format
    const timeline: TimelinePoint[] = Array.from(byDate.entries())
      .sort(([dateA], [dateB]) => (dateA < dateB ? -1 : dateA > dateB ? 1 : 0))
      .map(([date, driversMap]) => {
        const drivers: Record<string, { name: string; completed: number }> =
          {};
        driversMap.forEach((value, driverId) => {
          drivers[driverId] = value;
        });
        return { date, drivers };
      });

    // console.log(`Driver Timeline: Generated ${timeline.length} points`);

    return NextResponse.json({ ok: true, timeline }, { status: 200 });
  } catch (e: any) {
    console.error('Internal error in driver timeline:', e);
    return NextResponse.json(
      { ok: false, error: e?.message || 'internal' },
      { status: 500 }
    );
  }
}
