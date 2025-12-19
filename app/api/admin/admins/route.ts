import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { adminSchema } from '@/lib/schemas/admin';

// Normalize employeeId for consistency
function normalizeEmployeeId(raw: string): string {
  const trimmed = (raw || '').trim();
  if (!trimmed) return 'UNKNOWN';
  return trimmed.toUpperCase();
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const roleCookie = cookieStore.get('toyota_role')?.value;
    if (!roleCookie || (roleCookie !== 'admin' && roleCookie !== 'manager' && roleCookie !== 'viewer')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('profiles')
      .select('id, name, email, employee_id, role, created_at, updated_at')
      .in('role', ['admin', 'manager', 'viewer'])
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      {
        ok: true,
        data: data ?? [],
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

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const roleCookie = cookieStore.get('toyota_role')?.value;
    if (!roleCookie || (roleCookie !== 'admin' && roleCookie !== 'manager' && roleCookie !== 'viewer')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const payload = {
      name: body?.name,
      employeeId: body?.employeeId ? String(body.employeeId).trim() || undefined : undefined,
      email: body?.email,
      password: body?.password,
      role: body?.role,
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

    const { name, employeeId, email, password, role } = result.data;

    if (!password) {
      return NextResponse.json(
        { error: 'סיסמה היא שדה חובה' },
        { status: 400 },
      );
    }

    const admin = getSupabaseAdmin();

    // Check if email already exists
    const { data: existingByEmail, error: emailCheckErr } = await admin
      .from('profiles')
      .select('id')
      .eq('email', email)
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

    // Check if employeeId exists (if provided)
    if (employeeId) {
      const normalizedEmployeeId = normalizeEmployeeId(employeeId);
      const { data: existingByEmployeeId, error: existingErr } = await admin
        .from('profiles')
        .select('id')
        .eq('employee_id', normalizedEmployeeId)
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

    // Create auth user with provided email and password
    const { data: createdUser, error: createErr } =
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { username: email.split('@')[0], name },
        app_metadata: { role },
      });

    if (createErr || !createdUser?.user?.id) {
      return NextResponse.json(
        { error: createErr?.message || 'Failed to create auth user' },
        { status: 400 },
      );
    }

    const userId = createdUser.user.id;

    // Create profile with role and optional employee_id
    const profileData: any = {
      id: userId,
      email,
      role,
      name,
    };

    if (employeeId) {
      profileData.employee_id = normalizeEmployeeId(employeeId);
    }

    const { data: profile, error: upErr } = await admin
      .from('profiles')
      .upsert(profileData, { onConflict: 'id' })
      .select('id, name, email, employee_id, role, created_at, updated_at')
      .single();

    if (upErr) {
      return NextResponse.json(
        { error: upErr.message || 'Failed to upsert profile' },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        data: profile,
      },
      { status: 201 },
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Internal server error' },
      { status: 500 },
    );
  }
}

