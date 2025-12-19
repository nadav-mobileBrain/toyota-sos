import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * GET /api/admin/notifications
 * Get notifications for the currently logged-in admin/manager
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const userIdCookie = cookieStore.get('toyota_user_id')?.value;
    const roleCookie = cookieStore.get('toyota_role')?.value;

    if (!userIdCookie || (roleCookie !== 'admin' && roleCookie !== 'manager' && roleCookie !== 'viewer')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '0', 10);
    const pageSize = parseInt(url.searchParams.get('pageSize') || '20', 10);

    const from = page * pageSize;
    const to = from + pageSize - 1;

    const admin = getSupabaseAdmin();
    
    // Fetch notifications for this user
    const { data, error } = await admin
      .from('notifications')
      .select('*')
      .eq('user_id', userIdCookie)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data: data || [] }, { status: 200 });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/notifications
 * Mark notifications as read
 */
export async function PATCH(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const userIdCookie = cookieStore.get('toyota_user_id')?.value;
    const roleCookie = cookieStore.get('toyota_role')?.value;

    if (!userIdCookie || (roleCookie !== 'admin' && roleCookie !== 'manager' && roleCookie !== 'viewer')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, read } = body;

    const admin = getSupabaseAdmin();

    if (id) {
        // Mark specific
        const { error } = await admin
            .from('notifications')
            .update({ read: read ?? true })
            .eq('id', id)
            .eq('user_id', userIdCookie); // Security check
        
        if (error) throw error;
    } else {
        // Mark all
        const { error } = await admin
            .from('notifications')
            .update({ read: true })
            .eq('user_id', userIdCookie);
            
        if (error) throw error;
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/notifications
 * Delete all notifications for the current user
 */
export async function DELETE(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const userIdCookie = cookieStore.get('toyota_user_id')?.value;
    const roleCookie = cookieStore.get('toyota_role')?.value;

    if (!userIdCookie || (roleCookie !== 'admin' && roleCookie !== 'manager' && roleCookie !== 'viewer')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = getSupabaseAdmin();

    const { error } = await admin
      .from('notifications')
      .delete()
      .eq('user_id', userIdCookie);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
