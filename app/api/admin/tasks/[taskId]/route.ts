import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { cookies } from 'next/headers';

/**
 * PATCH /api/admin/tasks/[taskId]
 * Update task status or other fields
 * Only accessible by admin/manager users
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    // Check authentication via cookie
    const cookieStore = await cookies();
    const roleCookie = cookieStore.get('toyota_role')?.value;
    
    if (!roleCookie || (roleCookie !== 'admin' && roleCookie !== 'manager')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { taskId } = await params;
    const body = await request.json();

    // Only allow updating specific fields
    const allowedFields = [
      'title',
      'type',
      'priority',
      'status',
      'details',
      'estimated_start',
      'estimated_end',
      'address',
      'client_id',
      'vehicle_id',
    ];
    const updatePayload: Record<string, any> = {};

    Object.entries(body).forEach(([key, value]) => {
      if (allowedFields.includes(key)) {
        updatePayload[key] = value;
      }
    });

    // Add metadata
    updatePayload.updated_at = new Date().toISOString();
    // Note: updated_by would require extracting user ID from auth context

    // Update in Supabase
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('tasks')
      .update(updatePayload)
      .eq('id', taskId)
      .select('*')
      .single();

    if (error) {
      console.error('Error updating task:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, data }, { status: 200 });
  } catch (error) {
    console.error('Error in PATCH /api/admin/tasks/[taskId]:', error);
    console.error('Error details:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/tasks/[taskId]
 * Delete a task (and rely on FK constraints for related rows)
 * Only accessible by admin/manager users
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const cookieStore = await cookies();
    const roleCookie = cookieStore.get('toyota_role')?.value;
    if (!roleCookie || (roleCookie !== 'admin' && roleCookie !== 'manager')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { taskId } = await params;
    const admin = getSupabaseAdmin();
    // Soft-delete: mark task as deleted instead of hard delete
    const { error } = await admin
      .from('tasks')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', taskId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

