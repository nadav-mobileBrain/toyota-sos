import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { cookies } from 'next/headers';

/**
 * PATCH /api/admin/tasks/[taskId]/assign
 * Update the lead driver assignment for a task
 * Only accessible by admin/manager users
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    // Check authentication via cookie
    const cookieStore = cookies();
    const roleCookie = cookieStore.get('toyota_role')?.value;
    
    if (!roleCookie || (roleCookie !== 'admin' && roleCookie !== 'manager')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { taskId } = await params;
    const { driver_id } = await request.json();

    if (!driver_id) {
      return NextResponse.json(
        { error: 'driver_id is required' },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();

    // Find current lead assignee
    const { data: currentAssignees } = await admin
      .from('task_assignees')
      .select('*')
      .eq('task_id', taskId)
      .eq('is_lead', true);

    // Remove old lead assignment if exists
    if (currentAssignees && currentAssignees.length > 0) {
      await admin
        .from('task_assignees')
        .delete()
        .eq('task_id', taskId)
        .eq('is_lead', true);
    }

    // Create new lead assignment
    const { data, error } = await admin
      .from('task_assignees')
      .insert({
        task_id: taskId,
        driver_id,
        is_lead: true,
        assigned_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (error) {
      console.error('Error assigning driver:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    // Update task's updated_at timestamp
    await admin
      .from('tasks')
      .update({
        updated_by: session.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId);

    return NextResponse.json({ success: true, data }, { status: 200 });
  } catch (error) {
    console.error('Error in PATCH /api/admin/tasks/[taskId]/assign:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

