import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { driverSchema } from '@/lib/schemas/driver';

// Normalize employeeId for synthetic email + password derivation
function normalizeEmployeeId(raw: string): string {
  const trimmed = (raw || '').trim();
  if (!trimmed) return 'UNKNOWN';
  return trimmed.toUpperCase();
}

function derivePassword(employeeId: string): string {
  const digits = employeeId.replace(/\D/g, '');
  const lastTwo = digits.slice(-2) || '01';
  return `Driver@2025${lastTwo}`;
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
      .eq('role', 'driver')
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
    // Allow empty-string email on the wire → treat as undefined
    const payload = {
      name: body?.name,
      employeeId: body?.employeeId,
      email: body?.email ? String(body.email).trim() || undefined : undefined,
    };

    const result = driverSchema.safeParse(payload);
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

    const { name, employeeId, email } = result.data;
    const normalizedEmployeeId = normalizeEmployeeId(employeeId);

    const admin = getSupabaseAdmin();

    // Enforce uniqueness at app level (DB has unique constraint as well)
    const { data: existingByEmployeeId, error: existingErr } = await admin
      .from('profiles')
      .select('id')
      .eq('employee_id', normalizedEmployeeId)
      .maybeSingle();

    if (existingErr && existingErr.code !== 'PGRST116') {
      // Non "no rows" error
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

    const finalEmail =
      email ||
      `driver+${normalizedEmployeeId.replace(/[^A-Z0-9]/g, '')}@toyota.local`;
    const password = derivePassword(normalizedEmployeeId);

    // Create auth user
    const { data: createdUser, error: createErr } =
      await admin.auth.admin.createUser({
        email: finalEmail,
        password,
        email_confirm: true,
        user_metadata: { username: finalEmail.split('@')[0], name },
        app_metadata: { role: 'driver' },
      });

    if (createErr || !createdUser?.user?.id) {
      return NextResponse.json(
        { error: createErr?.message || 'Failed to create auth user' },
        { status: 400 },
      );
    }

    const userId = createdUser.user.id;

    // Upsert profile with role + employee_id
    const { data: profile, error: upErr } = await admin
      .from('profiles')
      .upsert(
        {
          id: userId,
          email: finalEmail,
          role: 'driver',
          name,
          employee_id: normalizedEmployeeId,
        },
        { onConflict: 'id' },
      )
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


