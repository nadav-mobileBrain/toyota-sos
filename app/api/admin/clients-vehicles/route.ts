import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import {
  isValidLicensePlate,
  normalizeLicensePlate,
} from '@/lib/vehicleLicensePlate';

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
      .from('clients_vehicles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      {
        ok: true,
        data: data ?? [],
      },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Internal server error' },
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
      (roleCookie !== 'admin' && roleCookie !== 'manager' && roleCookie !== 'viewer')
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { client_id, license_plate, model } = body || {};

    if (!client_id || !license_plate) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate license plate format
    if (!isValidLicensePlate(license_plate)) {
      return NextResponse.json(
        { error: 'מספר רישוי חייב להכיל 7 או 8 ספרות' },
        { status: 400 }
      );
    }

    // Normalize license plate (remove dashes/spaces) before storing
    const normalizedPlate = normalizeLicensePlate(license_plate);

    const admin = getSupabaseAdmin();

    // Check for duplicate license plate for THIS client
    const { data: existing, error: existingErr } = await admin
      .from('clients_vehicles')
      .select('id')
      .eq('client_id', client_id)
      .eq('license_plate', normalizedPlate)
      .maybeSingle();

    if (existingErr) {
      return NextResponse.json(
        { error: existingErr.message },
        { status: 400 }
      );
    }

    if (existing?.id) {
      return NextResponse.json(
        {
          error: 'מספר רישוי זה כבר קיים עבור הלקוח',
          code: 'LICENSE_PLATE_EXISTS',
        },
        { status: 409 }
      );
    }

    const { data, error } = await admin
      .from('clients_vehicles')
      .insert({
        client_id,
        license_plate: normalizedPlate,
        model: model || null,
      })
      .select('*')
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
