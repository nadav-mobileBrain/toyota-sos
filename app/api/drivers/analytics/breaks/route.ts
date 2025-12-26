import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

interface DriverBreakAgg {
  driver_id: string;
  driver_name: string | null;
  employee_id: string | null;
  totalDurationMinutes: number;
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

    const rangeStart = new Date(from);
    const rangeEnd = new Date(to);
    
    // Validate dates
    if (isNaN(rangeStart.getTime()) || isNaN(rangeEnd.getTime())) {
        return NextResponse.json(
            { ok: false, error: 'invalid-dates' },
            { status: 400 }
        );
    }

    const admin = getSupabaseAdmin();

    // Fetch breaks that overlap with the range or started within the range
    // We want breaks where started_at < rangeEnd AND (ended_at > rangeStart OR ended_at is null)
    const { data, error } = await admin
      .from('driver_breaks')
      .select('driver_id, started_at, ended_at, profiles:driver_id(name,employee_id)')
      .lt('started_at', rangeEnd.toISOString())
      .or(`ended_at.gt.${rangeStart.toISOString()},ended_at.is.null`);

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 400 }
      );
    }

    const byDriver = new Map<string, DriverBreakAgg>();
    const now = new Date();

    (data || []).forEach((row: any) => {
      const driverId = row.driver_id;
      const startedAt = new Date(row.started_at);
      
      // Calculate effective end time
      // If ended_at is null, use now.
      // If ended_at is present, use it.
      // Then clamp to rangeEnd if needed (optional, but requested "according to selected time period"). 
      // Usually "in the selected period" means we count the break if it happened then.
      // If we want exact minutes *within* the window, we clamp start and end.
      // Let's stick to the plan: "Handle ongoing breaks... by treating them as ending at the current time".
      // I will calculate the duration of the break itself. 
      // If the user selects "Yesterday", an ongoing break today shouldn't probably count as "infinite" yesterday.
      // But usually "breaks in period" means breaks that *occurred* in that period.
      // Let's simple calculation: duration = (end || now) - start.
      
      let endAt = row.ended_at ? new Date(row.ended_at) : now;
      
      // Basic sanity check
      if (endAt < startedAt) return; 

      const durationMs = endAt.getTime() - startedAt.getTime();
      const durationMinutes = Math.round(durationMs / 60000);

      const profiles = row.profiles;
      const profileArray = Array.isArray(profiles)
        ? profiles
        : profiles
        ? [profiles]
        : [];
      const name = (profileArray[0]?.name as string) || 'Unknown';
      const employeeId = (profileArray[0]?.employee_id as string) || null;
      
      const existing = byDriver.get(driverId) || {
        driver_id: driverId,
        driver_name: name,
        employee_id: employeeId,
        totalDurationMinutes: 0,
        count: 0
      };

      existing.totalDurationMinutes += durationMinutes;
      existing.count += 1;
      byDriver.set(driverId, existing);
    });

    const drivers = Array.from(byDriver.values())
      .map((d) => ({
        driver_id: d.employee_id || d.driver_id,
        driver_name: d.driver_name,
        totalDurationMinutes: d.totalDurationMinutes,
        count: d.count,
      }))
      .sort((a, b) => b.totalDurationMinutes - a.totalDurationMinutes);

    return NextResponse.json(
      { ok: true, data: drivers },
      { status: 200 }
    );

  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || 'internal' },
      { status: 500 }
    );
  }
}

