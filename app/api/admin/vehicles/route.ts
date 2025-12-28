import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import {
  isValidLicensePlate,
  normalizeLicensePlate,
} from '@/lib/vehicleLicensePlate';
import { vehicleSchema } from '@/lib/schemas/vehicle';

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
      .from('vehicles')
      .select('id, license_plate, model, is_available, unavailability_reason, created_at, updated_at')
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

    const body = await request.json().catch(() => ({}));
    const payload = {
      license_plate: body?.license_plate,
      model: body?.model,
      is_available: body?.is_available ?? true,
      unavailability_reason: body?.unavailability_reason || null,
    };

    const result = vehicleSchema.safeParse(payload);
    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors;
      return NextResponse.json(
        {
          error: 'Validation failed',
          fieldErrors,
        },
        { status: 400 }
      );
    }

    const { license_plate, model, is_available, unavailability_reason } =
      result.data;

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

    // Check for duplicate license plate
    const { data: existing, error: existingErr } = await admin
      .from('vehicles')
      .select('id')
      .eq('license_plate', normalizedPlate)
      .maybeSingle();

    if (existingErr && existingErr.code !== 'PGRST116') {
      return NextResponse.json(
        { error: existingErr.message },
        { status: 400 }
      );
    }

    if (existing?.id) {
      return NextResponse.json(
        {
          error: 'מספר רישוי כבר קיים במערכת',
          code: 'LICENSE_PLATE_EXISTS',
        },
        { status: 409 }
      );
    }

    const { data, error } = await admin
      .from('vehicles')
      .insert({
        license_plate: normalizedPlate,
        model: model || null,
        is_available,
        unavailability_reason: is_available ? null : unavailability_reason || null,
      })
      .select('id, license_plate, model, is_available, unavailability_reason, created_at, updated_at')
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


