import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

function getDriverIdFromRequest(req: NextRequest): string | null {
  const headerId = req.headers.get('x-toyota-user-id')?.trim();
  if (headerId) return headerId;
  const url = new URL(req.url);
  const queryId = url.searchParams.get('user_id')?.trim();
  return queryId || null;
}

/**
 * POST /api/driver/break
 * Start a break for the authenticated driver
 */
export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const userIdCookie = cookieStore.get('toyota_user_id')?.value;
    const roleCookie = cookieStore.get('toyota_role')?.value;

    // Support two driver auth modes:
    // 1) Cookie-based driver session (preferred)
    // 2) Local driver session (client sends user_id via header/query)
    const driverId =
      roleCookie === 'driver' && userIdCookie
        ? userIdCookie
        : getDriverIdFromRequest(req);

    if (!driverId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = getSupabaseAdmin();

    // Validate driver exists and is a driver
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('id, role')
      .eq('id', driverId)
      .single();
    if (profileError || !profile || profile.role !== 'driver') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if driver already has an active break
    const { data: activeBreak, error: checkError } = await admin
      .from('driver_breaks')
      .select('id')
      .eq('driver_id', driverId)
      .is('ended_at', null)
      .maybeSingle();

    if (checkError) {
      console.error('Error checking active break:', checkError);
      return NextResponse.json(
        { error: 'Failed to check break status' },
        { status: 500 }
      );
    }

    if (activeBreak) {
      return NextResponse.json(
        { error: 'Driver already has an active break' },
        { status: 400 }
      );
    }

    // Create new break
    const breakData = {
      driver_id: driverId,
      started_at: new Date().toISOString(),
    };
    console.log('[API] Creating break:', breakData);
    const { data: newBreak, error: insertError } = await admin
      .from('driver_breaks')
      .insert(breakData)
      .select()
      .single();

    if (insertError) {
      console.error('[API] Error creating break:', insertError);
      return NextResponse.json(
        { error: 'Failed to start break' },
        { status: 500 }
      );
    }

    console.log('[API] ✅ Break created successfully:', newBreak);
    return NextResponse.json({ ok: true, data: newBreak });
  } catch (error) {
    console.error('Error in POST /api/driver/break:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/driver/break
 * End the current active break for the authenticated driver
 */
export async function PATCH(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const userIdCookie = cookieStore.get('toyota_user_id')?.value;
    const roleCookie = cookieStore.get('toyota_role')?.value;

    const driverId =
      roleCookie === 'driver' && userIdCookie
        ? userIdCookie
        : getDriverIdFromRequest(req);

    if (!driverId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = getSupabaseAdmin();

    // Validate driver exists and is a driver
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('id, role')
      .eq('id', driverId)
      .single();
    if (profileError || !profile || profile.role !== 'driver') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find active break
    const { data: activeBreak, error: findError } = await admin
      .from('driver_breaks')
      .select('id')
      .eq('driver_id', driverId)
      .is('ended_at', null)
      .maybeSingle();

    if (findError) {
      console.error('Error finding active break:', findError);
      return NextResponse.json(
        { error: 'Failed to find break' },
        { status: 500 }
      );
    }

    if (!activeBreak) {
      return NextResponse.json(
        { error: 'No active break found' },
        { status: 404 }
      );
    }

    // End the break
    const endedAt = new Date().toISOString();
    console.log('[API] Ending break:', { breakId: activeBreak.id, ended_at: endedAt });
    const { data: updatedBreak, error: updateError } = await admin
      .from('driver_breaks')
      .update({ ended_at: endedAt })
      .eq('id', activeBreak.id)
      .select()
      .single();

    if (updateError) {
      console.error('[API] Error ending break:', updateError);
      return NextResponse.json(
        { error: 'Failed to end break' },
        { status: 500 }
      );
    }

    console.log('[API] ✅ Break ended successfully:', updatedBreak);
    return NextResponse.json({ ok: true, data: updatedBreak });
  } catch (error) {
    console.error('Error in PATCH /api/driver/break:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/driver/break
 * Get the current break status for the authenticated driver
 */
export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const userIdCookie = cookieStore.get('toyota_user_id')?.value;
    const roleCookie = cookieStore.get('toyota_role')?.value;

    const driverId =
      roleCookie === 'driver' && userIdCookie
        ? userIdCookie
        : getDriverIdFromRequest(req);

    if (!driverId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = getSupabaseAdmin();

    // Get active break
    const { data: activeBreak, error: findError } = await admin
      .from('driver_breaks')
      .select('id, started_at')
      .eq('driver_id', driverId)
      .is('ended_at', null)
      .maybeSingle();

    if (findError) {
      console.error('Error finding active break:', findError);
      return NextResponse.json(
        { error: 'Failed to check break status' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      data: {
        isOnBreak: !!activeBreak,
        break: activeBreak || null,
      },
    });
  } catch (error) {
    console.error('Error in GET /api/driver/break:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}


