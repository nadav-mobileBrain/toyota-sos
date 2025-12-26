import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { vehicleSchema } from '@/lib/schemas/vehicle';
import {
  isValidLicensePlate,
  normalizeLicensePlate,
} from '@/lib/vehicleLicensePlate';

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
    if (
      !roleCookie ||
      (roleCookie !== 'admin' &&
        roleCookie !== 'manager' &&
        roleCookie !== 'viewer')
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: 'Missing vehicle id' }, { status: 400 });
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

    // Ensure license_plate stays unique across vehicles (excluding this vehicle)
    const { data: existing, error: existingErr } = await admin
      .from('vehicles')
      .select('id')
      .eq('license_plate', normalizedPlate)
      .neq('id', id)
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
      .update({
        license_plate: normalizedPlate,
        model: model || null,
        is_available,
        unavailability_reason: is_available ? null : unavailability_reason || null,
      })
      .eq('id', id)
      .select('id, license_plate, model, is_available, unavailability_reason, created_at')
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message || 'Failed to update vehicle' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        data,
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

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<Params> }
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

    const { id } = await context.params;
    if (!id) {
      return NextResponse.json(
        { error: 'Missing vehicle id' },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();

    const { error: deleteErr } = await admin
      .from('vehicles')
      .delete()
      .eq('id', id);

    if (deleteErr) {
      return NextResponse.json(
        { error: deleteErr.message || 'Failed to delete vehicle' },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

