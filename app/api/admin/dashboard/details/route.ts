import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { cookies } from 'next/headers';

/**
 * GET /api/admin/dashboard/details?metric=created|completed|overdue|on_time|late&from=YYYY-MM-DD&to=YYYY-MM-DD&tz=...
 * Returns rows for drill-down views based on the selected metric and period.
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const roleCookie = cookieStore.get('toyota_role')?.value;
    if (!roleCookie || (roleCookie !== 'admin' && roleCookie !== 'manager')) {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    const url = new URL(request.url);
    const metric = (url.searchParams.get('metric') || '').toLowerCase();
    const from = url.searchParams.get('from') || '';
    const to = url.searchParams.get('to') || '';
    if (!metric || !from || !to) {
      return NextResponse.json(
        { ok: false, error: 'Missing query params' },
        { status: 400 }
      );
    }
    const admin = getSupabaseAdmin();

    // Base selection
    let q = admin
      .from('tasks')
      .select(
        'id,title,type,status,priority,created_at,updated_at,estimated_end,task_assignees!left(driver_id,profiles!task_assignees_driver_id_fkey(name))'
      )
      .order('created_at', { ascending: false });

    if (metric === 'scheduled') {
      q = q.gte('estimated_start', from).lte('estimated_start', to);
    } else if (metric === 'created') {
      // Legacy/Alternative: strictly created_at
      q = q.gte('created_at', from).lte('created_at', to);
    } else if (metric === 'completed') {
      q = q
        .eq('status', 'הושלמה')
        .gte('estimated_start', from)
        .lte('estimated_start', to);
    } else if (metric === 'overdue') {
      // Legacy: Currently overdue (not completed)
      q = q
        .neq('status', 'הושלמה')
        .gte('estimated_end', from)
        .lte('estimated_end', to);
    } else if (metric === 'on_time') {
      // Completed On Time (based on scheduled window)
      q = q
        .eq('status', 'הושלמה')
        .gte('estimated_start', from)
        .lte('estimated_start', to);
    } else if (metric === 'late') {
      // Completed Late (based on scheduled window)
      q = q
        .eq('status', 'הושלמה')
        .gte('estimated_start', from)
        .lte('estimated_start', to);
    } else if (metric === 'pending') {
      q = q
        .eq('status', 'בהמתנה')
        .gte('estimated_start', from)
        .lte('estimated_start', to);
    } else if (metric === 'in_progress') {
      q = q
        .eq('status', 'בעבודה')
        .gte('estimated_start', from)
        .lte('estimated_start', to);
    } else if (metric === 'cancelled') {
      q = q
        .eq('status', 'חסומה')
        .gte('estimated_start', from)
        .lte('estimated_start', to);
    } else {
      return NextResponse.json(
        { ok: false, error: 'Unknown metric' },
        { status: 400 }
      );
    }

    const { data, error } = await q;
    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 400 }
      );
    }
    const rows = (data || []).map((t: any) => {
      const lead = Array.isArray(t.task_assignees)
        ? t.task_assignees.find((a: any) => a?.is_lead) || t.task_assignees[0]
        : null;
      const driver_name = lead?.profiles?.name || null;
      return {
        id: t.id,
        title: t.title,
        type: t.type,
        status: t.status,
        priority: t.priority,
        created_at: t.created_at,
        updated_at: t.updated_at,
        estimated_end: t.estimated_end,
        driver_name,
      };
    });
    let final = rows;
    if (metric === 'late') {
      final = rows.filter(
        (r) =>
          r.estimated_end &&
          r.updated_at &&
          new Date(r.updated_at) > new Date(r.estimated_end)
      );
    } else if (metric === 'on_time') {
      final = rows.filter(
        (r) =>
          r.estimated_end &&
          r.updated_at &&
          new Date(r.updated_at) <= new Date(r.estimated_end)
      );
    }
    return NextResponse.json({ ok: true, rows: final }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || 'Internal error' },
      { status: 500 }
    );
  }
}
