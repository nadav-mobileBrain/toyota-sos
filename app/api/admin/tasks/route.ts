import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import type { TaskAssignee } from '@/types/task';
import { notify } from '@/lib/notify';

const multiStopTypes = new Set(['הסעת לקוח הביתה', 'הסעת לקוח למוסך']);
const multiStopAliases = new Set(['drive_client_home', 'drive_client_to_dealership']);
const isMultiStopType = (val: string | null | undefined) => {
  const normalized = (val || '').trim();
  return multiStopTypes.has(normalized) || multiStopAliases.has(normalized);
};

/**
 * POST /api/admin/tasks
 * Create a new task and optional driver assignments
 * Body: {
 *   title, type, priority, status, details?, estimated_start?, estimated_end?, address?,
 *   client_id?, vehicle_id?, lead_driver_id?, co_driver_ids?: string[]
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const roleCookie = cookieStore.get('toyota_role')?.value;
    if (!roleCookie || (roleCookie !== 'admin' && roleCookie !== 'manager')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      title,
      type,
      priority,
      status,
      details,
      advisor_name,
      estimated_start,
      estimated_end,
      address,
      client_id,
      vehicle_id,
      lead_driver_id,
      co_driver_ids,
      stops,
    } = body || {};

    if (!type || !priority || !status) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();

    const isMulti =
      isMultiStopType(type) || (Array.isArray(stops) && stops.length > 0);

    // Normalize stops if provided
    let normalizedStops: {
      client_id: string;
      address: string;
      advisor_name: string | null;
      sort_order: number;
    }[] = [];

    if (isMulti) {
      if (!Array.isArray(stops) || stops.length === 0) {
        return NextResponse.json(
          { error: 'חובה לציין לפחות לקוח אחד עבור סוג משימה זה' },
          { status: 400 }
        );
      }

      normalizedStops = stops.map((s: any, idx: number) => ({
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
    }

    // Align legacy fields with first stop (for compatibility with existing flows)
    const firstStop = normalizedStops[0];
    const effectiveClientId = isMulti
      ? firstStop?.client_id
      : client_id ?? null;
    const effectiveAddress = isMulti ? firstStop?.address ?? '' : address ?? '';
    const effectiveAdvisorName = isMulti
      ? firstStop?.advisor_name ?? null
      : advisor_name ?? null;
    // Insert task
    const { data: created, error } = await admin
      .from('tasks')
      .insert({
        title,
        type,
        priority,
        status,
        details: details ?? null,
        advisor_name: effectiveAdvisorName,
        estimated_start: estimated_start ?? null,
        estimated_end: estimated_end ?? null,
        address: effectiveAddress ?? '',
        client_id: effectiveClientId ?? null,
        vehicle_id: vehicle_id ?? null,
      })
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Insert stops when applicable
    let createdStops = [];
    if (isMulti && normalizedStops.length > 0) {
      const { data: stopsInserted, error: stopsError } = await admin
        .from('task_stops')
        .insert(
          normalizedStops.map((s) => ({
            ...s,
            task_id: created.id,
          }))
        )
        .select('*');

      if (stopsError) {
        // Best-effort cleanup to avoid orphaned task without stops
        await admin.from('tasks').delete().eq('id', created.id);
        return NextResponse.json(
          { error: stopsError.message },
          { status: 400 }
        );
      }
      createdStops = stopsInserted || [];
    }

    // Insert assignments if provided
    const inserts: TaskAssignee[] = [];
    if (lead_driver_id) {
      inserts.push({
        id: crypto.randomUUID(),
        task_id: created.id,
        driver_id: lead_driver_id,
        is_lead: true,
        assigned_at: new Date().toISOString(),
      });
    }
    if (Array.isArray(co_driver_ids) && co_driver_ids.length > 0) {
      for (const id of co_driver_ids) {
        // skip if same as lead
        if (id && id !== lead_driver_id) {
          inserts.push({
            id: crypto.randomUUID(),
            task_id: created.id,
            driver_id: id,
            is_lead: false,
            assigned_at: new Date().toISOString(),
          });
        }
      }
    }
    if (inserts.length > 0) {
      await admin.from('task_assignees').insert(inserts);

      // Notify assigned drivers
      try {
        const recipientIds = inserts.map((i) => i.driver_id);
        // We don't have subscriptions here yet, but notifyWithPreferences will insert DB notifications
        const recipients = recipientIds.map((uid) => ({
          user_id: uid,
          subscription: undefined,
        }));

        await notify({
          type: 'assigned',
          task_id: created.id,
          recipients,
          payload: {
            title: 'משימה חדשה',
            body: `הוקצתה לך משימה חדשה: ${created.type || created.title || 'ללא כותרת'}`,
            taskId: created.id,
            taskType: created.type,
            url: `/driver/tasks/${created.id}`,
          },
        });
      } catch (err) {
        console.error('Failed to notify drivers on create:', err);
        // Do not fail the request if notification fails
      }
    }

    const responseTask = isMulti
      ? { ...created, stops: createdStops }
      : created;

    return NextResponse.json({ ok: true, data: responseTask }, { status: 200 });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
