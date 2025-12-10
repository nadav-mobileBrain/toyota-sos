import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { cookies } from 'next/headers';
import { notify } from '@/lib/notify';

const multiStopTypes = new Set(['הסעת לקוח הביתה', 'הסעת לקוח למוסך']);
const multiStopAliases = new Set(['drive_client_home', 'drive_client_to_dealership']);
const isMultiStopType = (val: string | null | undefined) => {
  const normalized = (val || '').trim();
  return multiStopTypes.has(normalized) || multiStopAliases.has(normalized);
};

type StopPayload = {
  client_id: string;
  address: string;
  advisor_name: string | null;
  sort_order: number;
};

function normalizeStops(rawStops: any[]): StopPayload[] {
  return rawStops.map((s: any, idx: number) => ({
    client_id: typeof s?.client_id === 'string' ? s.client_id : '',
    address: typeof s?.address === 'string' ? s.address.trim() : '',
    advisor_name:
      typeof s?.advisor_name === 'string' && s.advisor_name.trim()
        ? s.advisor_name.trim()
        : null,
    sort_order:
      typeof s?.sort_order === 'number' && Number.isFinite(s.sort_order)
        ? s.sort_order
        : idx,
  }));
}

/**
 * PATCH /api/admin/tasks/[taskId]
 * Update task status or other fields
 * Only accessible by admin/manager users
 */
export async function GET(
  _request: NextRequest,
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
    const { data, error } = await admin
      .from('tasks')
      .select('*, task_stops(*)')
      .eq('id', taskId)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message || 'Task not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

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
      'advisor_name',
    ];
    const updatePayload: Record<string, any> = {};

    Object.entries(body).forEach(([key, value]) => {
      if (allowedFields.includes(key)) {
        updatePayload[key] = value;
      }
    });

    const rawStops = Array.isArray(body?.stops) ? body.stops : [];
    const normalizedStops = rawStops.length ? normalizeStops(rawStops) : [];

    // Fetch current task info when needed (type derivation or to ensure existence)
    let currentTask:
      | { type?: string | null; client_id?: string | null; address?: string | null; advisor_name?: string | null }
      | null = null;
    if (normalizedStops.length > 0 || updatePayload.type) {
      const admin = getSupabaseAdmin();
      const { data: existing, error: existingError } = await admin
        .from('tasks')
        .select('type, client_id, address, advisor_name')
        .eq('id', taskId)
        .single();

      if (existingError || !existing) {
        return NextResponse.json(
          { error: existingError?.message || 'Task not found' },
          { status: 404 }
        );
      }
      currentTask = existing;
    }

    const effectiveType =
      (updatePayload.type as string | undefined) ??
      (currentTask?.type as string | undefined);
    const isMulti =
      isMultiStopType(effectiveType) || normalizedStops.length > 0;

    if (normalizedStops.length > 0) {
      if (!isMulti) {
        return NextResponse.json(
          { error: 'לא ניתן לעדכן מספר לקוחות עבור סוג משימה זה' },
          { status: 400 }
        );
      }

      for (const stop of normalizedStops) {
        if (!stop.client_id) {
          return NextResponse.json(
            { error: 'חובה לבחור לקוח עבור כל עצירה' },
            { status: 400 }
          );
        }
        if (!stop.address) {
          return NextResponse.json(
            { error: 'חובה להזין כתובת עבור כל עצירה' },
            { status: 400 }
          );
        }
        if (!stop.advisor_name) {
          return NextResponse.json(
            { error: 'חובה להזין שם יועץ עבור כל עצירה' },
            { status: 400 }
          );
        }
      }

      // Keep legacy columns aligned with the primary stop
      const firstStop = normalizedStops[0];
      updatePayload.client_id = firstStop.client_id;
      updatePayload.address = firstStop.address;
      updatePayload.advisor_name = firstStop.advisor_name;
    }

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

    let updatedStops = null;
    if (normalizedStops.length > 0) {
      const { error: deleteError } = await admin
        .from('task_stops')
        .delete()
        .eq('task_id', taskId);

      if (deleteError) {
        return NextResponse.json(
          { error: deleteError.message },
          { status: 400 }
        );
      }

      const { data: insertedStops, error: insertError } = await admin
        .from('task_stops')
        .insert(
          normalizedStops.map((s) => ({
            ...s,
            task_id: taskId,
          }))
        )
        .select('*');

      if (insertError) {
        return NextResponse.json(
          { error: insertError.message },
          { status: 400 }
        );
      }
      updatedStops = insertedStops;
    }

    const responseData =
      normalizedStops.length > 0 && updatedStops ? { ...data, stops: updatedStops } : data;

    // Notify assigned drivers about the update
    try {
      // 1. Get assignees
      const { data: assignees } = await admin
        .from('task_assignees')
        .select('driver_id')
        .eq('task_id', taskId);

      if (assignees && assignees.length > 0) {
        const recipients = assignees.map((a) => ({
          user_id: a.driver_id,
          subscription: undefined,
        }));

        await notify({
          type: 'updated',
            task_id: taskId,
            recipients,
            payload: {
              title: 'עדכון משימה',
              body: `עודכנו פרטי משימה: ${data.type || data.title || 'ללא כותרת'}`,
            taskId: taskId,
            taskType: data.type,
            url: `/driver/tasks/${taskId}`,
            changes: Object.keys(updatePayload),
          },
        });
      }
    } catch (notifyErr) {
      console.error('Failed to notify drivers on update:', notifyErr);
      // Do not fail the response
    }

    return NextResponse.json({ success: true, data: responseData }, { status: 200 });
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
