import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { adminSchema } from '@/lib/schemas/admin';

type Params = {
  id: string;
};

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<Params> }
) {
  try {
    const cookieStore = await cookies();
    const roleCookie = cookieStore.get('toyota_role')?.value;
    if (!roleCookie || roleCookie !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: 'Missing admin id' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const payload = {
      name: body?.name,
      employeeId: body?.employeeId ? String(body.employeeId).trim() || undefined : undefined,
      email: body?.email,
      role: body?.role,
      password: undefined, // Password updates not supported in PATCH
    };

    const result = adminSchema.safeParse(payload);
    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors;
      return NextResponse.json(
        {
          error: 'Validation failed',
          fieldErrors,
        },
        { status: 400 },
      );
    }

    const { name, employeeId, email, role } = result.data;
    const admin = getSupabaseAdmin();

    // Check if email is already used by another user
    const { data: existingByEmail, error: emailCheckErr } = await admin
      .from('profiles')
      .select('id')
      .eq('email', email)
      .neq('id', id)
      .maybeSingle();

    if (emailCheckErr && emailCheckErr.code !== 'PGRST116') {
      return NextResponse.json(
        { error: emailCheckErr.message },
        { status: 400 },
      );
    }

    if (existingByEmail?.id) {
      return NextResponse.json(
        {
          error: 'אימייל כבר קיים במערכת',
          code: 'EMAIL_EXISTS',
        },
        { status: 409 },
      );
    }

    // Check employee_id uniqueness if provided
    if (employeeId) {
      const { data: existingByEmployeeId, error: existingErr } = await admin
        .from('profiles')
        .select('id')
        .eq('employee_id', employeeId)
        .neq('id', id)
        .maybeSingle();

      if (existingErr && existingErr.code !== 'PGRST116') {
        return NextResponse.json(
          { error: existingErr.message },
          { status: 400 },
        );
      }

      if (existingByEmployeeId?.id) {
        return NextResponse.json(
          {
            error: 'מספר עובד כבר קיים במערכת',
            code: 'EMPLOYEE_ID_EXISTS',
          },
          { status: 409 },
        );
      }
    }

    // Update auth user email + metadata
    try {
      await admin.auth.admin.updateUserById(id, {
        email,
        user_metadata: {
          name,
        },
        app_metadata: {
          role,
        },
      });
    } catch {
      // If this fails, we still proceed with profile update
    }

    // Build update object
    const updateData: any = {
      name,
      email,
      role,
    };

    // Only include employee_id if provided
    if (employeeId !== undefined) {
      updateData.employee_id = employeeId;
    }

    const { data: profile, error: upErr } = await admin
      .from('profiles')
      .update(updateData)
      .eq('id', id)
      .select('id, name, email, employee_id, role, created_at, updated_at')
      .single();

    if (upErr) {
      return NextResponse.json(
        { error: upErr.message || 'Failed to update admin' },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        data: profile,
      },
      { status: 200 },
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<Params> }
) {
  try {
    const cookieStore = await cookies();
    const roleCookie = cookieStore.get('toyota_role')?.value;
    if (!roleCookie || roleCookie !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: 'Missing admin id' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    // Delete auth user first (best-effort)
    try {
      await admin.auth.admin.deleteUser(id);
    } catch {
      // ignore; proceed with profile delete
    }

    const { error: deleteErr } = await admin
      .from('profiles')
      .delete()
      .eq('id', id);

    if (deleteErr) {
      return NextResponse.json(
        { error: deleteErr.message || 'Failed to delete admin' },
        { status: 400 },
      );
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Internal server error' },
      { status: 500 },
    );
  }
}

