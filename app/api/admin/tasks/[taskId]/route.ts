import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { cookies } from 'next/headers';
import { notify } from '@/lib/notify';

// Disable caching for API routes
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const multiStopTypes = new Set(['הסעת לקוח הביתה', 'הסעת לקוח למוסך']);
const multiStopAliases = new Set([
  'drive_client_home',
  'drive_client_to_dealership',
]);
const isMultiStopType = (val: string | null | undefined) => {
  const normalized = (val || '').trim();
  return multiStopTypes.has(normalized) || multiStopAliases.has(normalized);
};

type StopPayload = {
  client_id: string;
  address: string;
  advisor_name: string | null;
  advisor_color: string | null;
  phone: string;
  sort_order: number;
  distance_from_garage?: number | null;
  lat?: number | null;
  lng?: number | null;
};

function normalizeStops(rawStops: any[]): StopPayload[] {
  return rawStops.map((s: any, idx: number) => ({
    client_id: typeof s?.client_id === 'string' ? s.client_id : '',
    address: typeof s?.address === 'string' ? s.address.trim() : '',
    advisor_name:
      typeof s?.advisor_name === 'string' && s.advisor_name.trim()
        ? s.advisor_name.trim()
        : null,
    advisor_color:
      typeof s?.advisor_color === 'string' &&
      ['צהוב', 'ירוק', 'כתום', 'סגול בהיר'].includes(s.advisor_color)
        ? s.advisor_color
        : null,
    phone: typeof s?.phone === 'string' ? s.phone.trim() : '',
    sort_order:
      typeof s?.sort_order === 'number' && Number.isFinite(s.sort_order)
        ? s.sort_order
        : idx,
    distance_from_garage:
      typeof s?.distance_from_garage === 'number'
        ? s.distance_from_garage
        : null,
    lat: typeof s?.lat === 'number' ? s.lat : null,
    lng: typeof s?.lng === 'number' ? s.lng : null,
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
    const { data, error } = await admin
      .from('tasks')
      .select('*, task_stops(*)')
      .eq('id', taskId)
      .is('deleted_at', null)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message || 'Task not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { data },
      {
        status: 200,
        headers: {
          'Cache-Control':
            'no-store, no-cache, must-revalidate, proxy-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }
    );
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
    const userIdCookie = cookieStore.get('toyota_user_id')?.value;

    if (
      !roleCookie ||
      (roleCookie !== 'admin' &&
        roleCookie !== 'manager' &&
        roleCookie !== 'viewer')
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { taskId } = await params;
    const body = await request.json();

    // Fields that can be updated in the tasks table
    const allowedFields = [
      'type',
      'priority',
      'status',
      'details',
      'estimated_start',
      'estimated_end',
      'address',
      'client_id',
      'client_vehicle_id',
      'phone',
      'vehicle_id',
      'advisor_name',
      'advisor_color',
      'distance_from_garage',
      'lat',
      'lng',
    ];
    const updatePayload: Record<string, any> = {};

    Object.entries(body).forEach(([key, value]) => {
      if (allowedFields.includes(key)) {
        updatePayload[key] = value;
      }
    });

    const lead_driver_id = body.lead_driver_id;
    const co_driver_ids = body.co_driver_ids;
    const hasDriverUpdate =
      body.hasOwnProperty('lead_driver_id') ||
      body.hasOwnProperty('co_driver_ids');

    const rawStops = Array.isArray(body?.stops) ? body.stops : [];
    const normalizedStops = rawStops.length ? normalizeStops(rawStops) : [];

    // Fetch current task info - always needed for validation
    const admin = getSupabaseAdmin();
    const { data: currentTask, error: existingError } = await admin
      .from('tasks')
      .select(
        'type, client_id, client_vehicle_id, vehicle_id, address, advisor_name, advisor_color, status'
      )
      .eq('id', taskId)
      .is('deleted_at', null)
      .single();

    if (existingError || !currentTask) {
      return NextResponse.json(
        { error: existingError?.message || 'Task not found' },
        { status: 404 }
      );
    }

    // Determine effective type for validation
    const effectiveType: string | undefined =
      (updatePayload.type as string | undefined) ??
      (currentTask?.type as string | undefined);

    const isMulti =
      isMultiStopType(effectiveType) || normalizedStops.length > 0;

    // Determine effective lead driver for validation (lead driver lives in task_assignees)
    let effectiveLeadDriverId: string | null = null;
    if (body.hasOwnProperty('lead_driver_id')) {
      effectiveLeadDriverId =
        typeof lead_driver_id === 'string' && lead_driver_id.trim()
          ? lead_driver_id.trim()
          : null;
    } else {
      const { data: existingLead } = await admin
        .from('task_assignees')
        .select('driver_id')
        .eq('task_id', taskId)
        .eq('is_lead', true)
        .limit(1);
      effectiveLeadDriverId =
        existingLead && existingLead.length > 0
          ? existingLead[0]?.driver_id ?? null
          : null;
    }

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
        if (!stop.phone) {
          return NextResponse.json(
            { error: 'חובה להזין טלפון עבור כל עצירה' },
            { status: 400 }
          );
        }
        if (!stop.address) {
          return NextResponse.json(
            { error: 'חובה להזין כתובת עבור כל עצירה' },
            { status: 400 }
          );
        }
        if (!stop.advisor_name && !stop.advisor_color) {
          return NextResponse.json(
            { error: 'חובה להזין שם יועץ או לבחור צבע יועץ עבור כל עצירה' },
            { status: 400 }
          );
        }
      }

      // Keep legacy columns aligned with the primary stop
      const firstStop = normalizedStops[0];
      updatePayload.client_id = firstStop.client_id;
      updatePayload.address = firstStop.address;
      updatePayload.advisor_name = firstStop.advisor_name;
      updatePayload.advisor_color = firstStop.advisor_color;
      updatePayload.lat = firstStop.lat;
      updatePayload.lng = firstStop.lng;

      // Clear phone for multi-stop tasks (phone is stored in stops)
      updatePayload.phone = null;
    } else if (updatePayload.phone && typeof updatePayload.phone === 'string') {
      // For regular tasks, trim phone if provided
      updatePayload.phone = updatePayload.phone.trim() || null;
    }

    // Validation for "Drive Client Home" - must have advisor name or color
    if (effectiveType === 'הסעת לקוח הביתה') {
      const effectiveAdvisorName =
        updatePayload.advisor_name ?? currentTask?.advisor_name;
      const effectiveAdvisorColor =
        updatePayload.advisor_color ?? currentTask?.advisor_color;
      if (!effectiveAdvisorName && !effectiveAdvisorColor) {
        return NextResponse.json(
          {
            error:
              'חובה להזין שם יועץ או לבחור צבע יועץ עבור משימת הסעת לקוח הביתה',
          },
          { status: 400 }
        );
      }
    }

    // Vehicle validation:
    // Agency vehicle is required only when a lead driver is assigned (except "Test Execution",
    // where at least one of agency/client vehicle is required when a lead driver is assigned).
    const hasLeadDriver =
      typeof effectiveLeadDriverId === 'string' &&
      effectiveLeadDriverId.trim() !== '';

    if (hasLeadDriver) {
      const effectiveVehicleId =
        updatePayload.vehicle_id ?? currentTask?.vehicle_id;
      const effectiveClientVehicleId =
        updatePayload.client_vehicle_id ?? currentTask?.client_vehicle_id;

      if (
        (effectiveType === 'מסירת רכב חלופי' ||
          effectiveType === 'הסעת לקוח הביתה' ||
          effectiveType === 'חילוץ רכב תקוע') &&
        !effectiveVehicleId
      ) {
        return NextResponse.json(
          { error: 'חובה לבחור רכב סוכנות כאשר משוייך נהג מוביל למשימה' },
          { status: 400 }
        );
      }

      if (
        effectiveType === 'ביצוע טסט' &&
        !effectiveVehicleId &&
        !effectiveClientVehicleId
      ) {
        return NextResponse.json(
          {
            error:
              'חובה לבחור רכב (סוכנות או לקוח) כאשר משוייך נהג מוביל למשימה',
          },
          { status: 400 }
        );
      }
    }

    // Add metadata
    updatePayload.updated_at = new Date().toISOString();
    if (userIdCookie) {
      updatePayload.updated_by = userIdCookie;
    }

    // Update in Supabase - explicitly select all fields including advisor_color
    const { data, error } = await admin
      .from('tasks')
      .update(updatePayload)
      .eq('id', taskId)
      .is('deleted_at', null)
      .select('*')
      .single();

    if (error) {
      console.error('Error updating task:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
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
      normalizedStops.length > 0 && updatedStops
        ? { ...data, stops: updatedStops }
        : data;

    // Update assignments if provided
    if (hasDriverUpdate) {
      // 1. Remove old assignments
      const { error: deleteError } = await admin
        .from('task_assignees')
        .delete()
        .eq('task_id', taskId);

      if (deleteError) {
        console.error('Error deleting old assignments:', deleteError);
        return NextResponse.json(
          { error: deleteError.message },
          { status: 400 }
        );
      }

      // 2. Insert new ones
      const inserts: any[] = [];
      const seenDriverIds = new Set<string>();

      if (lead_driver_id) {
        inserts.push({
          task_id: taskId,
          driver_id: lead_driver_id,
          is_lead: true,
          assigned_at: new Date().toISOString(),
        });
        seenDriverIds.add(lead_driver_id);
      }

      if (Array.isArray(co_driver_ids) && co_driver_ids.length > 0) {
        for (const id of co_driver_ids) {
          if (id && !seenDriverIds.has(id)) {
            inserts.push({
              task_id: taskId,
              driver_id: id,
              is_lead: false,
              assigned_at: new Date().toISOString(),
            });
            seenDriverIds.add(id);
          }
        }
      }

      if (inserts.length > 0) {
        const { error: insertError } = await admin
          .from('task_assignees')
          .insert(inserts);

        if (insertError) {
          console.error('Error inserting new assignments:', insertError);
          return NextResponse.json(
            { error: insertError.message },
            { status: 400 }
          );
        }
      }
    }

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

        const isCancelled =
          updatePayload.status === 'חסומה' && currentTask?.status !== 'חסומה';

        await notify({
          type: isCancelled ? 'cancelled' : 'updated',
          task_id: taskId,
          task_date: data.estimated_start,
          recipients,
          payload: {
            title: isCancelled ? 'משימה בוטלה' : 'עדכון משימה',
            body: isCancelled
              ? `המשימה "${data.type || 'ללא כותרת'}" בוטלה על ידי המערכת`
              : `עודכנו פרטי משימה: ${data.type || 'ללא כותרת'}`,
            taskId: taskId,
            taskType: data.type,
            url: isCancelled ? '/driver' : `/driver/tasks/${taskId}`,
            changes: Object.keys(updatePayload),
          },
        });
      }
    } catch (notifyErr) {
      console.error('Failed to notify drivers on update:', notifyErr);
      // Do not fail the response
    }

    return NextResponse.json(
      { success: true, data: responseData },
      {
        status: 200,
        headers: {
          'Cache-Control':
            'no-store, no-cache, must-revalidate, proxy-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }
    );
  } catch (error) {
    console.error('Error in PATCH /api/admin/tasks/[taskId]:', error);
    console.error(
      'Error details:',
      error instanceof Error ? error.message : String(error)
    );
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
      },
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

    // 1. Fetch task and assignees before soft-deletion for notification
    const { data: taskData, error: fetchErr } = await admin
      .from('tasks')
      .select('type, estimated_start')
      .eq('id', taskId)
      .is('deleted_at', null)
      .single();

    const { data: assignees } = await admin
      .from('task_assignees')
      .select('driver_id')
      .eq('task_id', taskId);

    // Soft-delete: mark task as deleted instead of hard delete
    const { error } = await admin
      .from('tasks')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', taskId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // 2. Notify assigned drivers about the cancellation
    if (!fetchErr && taskData && assignees && assignees.length > 0) {
      try {
        const recipients = assignees.map((a: any) => ({
          user_id: a.driver_id,
          subscription: undefined,
        }));

        await notify({
          type: 'cancelled',
          task_id: taskId,
          task_date: taskData.estimated_start,
          recipients,
          payload: {
            title: 'משימה בוטלה',
            body: `המשימה "${
              taskData.type || 'ללא כותרת'
            }" בוטלה על ידי המערכת`,
            taskId: taskId,
            taskType: taskData.type,
            url: '/driver', // Task is gone, send to board
          },
        });
      } catch (notifyErr) {
        console.error('Failed to notify drivers on delete:', notifyErr);
      }
    }

    return NextResponse.json(
      { ok: true },
      {
        status: 200,
        headers: {
          'Cache-Control':
            'no-store, no-cache, must-revalidate, proxy-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }
    );
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
