import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { cookies } from 'next/headers';

/**
 * DELETE /api/admin/tasks/[taskId]/unassign
 * Remove all driver assignments from a task
 * Only accessible by admin/manager users
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    // Check authentication via cookie
    const cookieStore = await cookies();
    const roleCookie = cookieStore.get('toyota_role')?.value;

    if (
      !roleCookie ||
      (roleCookie !== 'admin' &&
        roleCookie !== 'manager' &&
        roleCookie !== 'viewer')
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { taskId } = await params;

    const admin = getSupabaseAdmin();

    // Remove all assignments for this task
    const { error } = await admin
      .from('task_assignees')
      .delete()
      .eq('task_id', taskId);

    if (error) {
      console.error('Error unassigning drivers:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Update task's updated_at timestamp (only if not deleted)
    await admin
      .from('tasks')
      .update({
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId)
      .is('deleted_at', null);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Error in DELETE /api/admin/tasks/[taskId]/unassign:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
