import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET() {
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

    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('clients')
      .select('id, name, phone, email')
      .order('name');

    if (error)
      return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ data }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Internal error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { name, phone } = body || {};

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'שם לקוח הוא שדה חובה' },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();

    // Check if client with same name already exists
    const { data: existing, error: existingErr } = await admin
      .from('clients')
      .select('id')
      .eq('name', name.trim())
      .maybeSingle();

    if (existingErr) {
      return NextResponse.json({ error: existingErr.message }, { status: 400 });
    }

    if (existing?.id) {
      return NextResponse.json(
        {
          error: 'לקוח עם שם זה כבר קיים',
          code: 'CLIENT_EXISTS',
        },
        { status: 409 }
      );
    }

    const { data, error } = await admin
      .from('clients')
      .insert({
        name: name.trim(),
        phone: phone || null,
      })
      .select('id, name, phone')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, data }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
