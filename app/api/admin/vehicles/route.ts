import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import {
  isValidLicensePlate,
  normalizeLicensePlate,
} from '@/lib/vehicleLicensePlate';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const roleCookie = cookieStore.get('toyota_role')?.value;
    if (!roleCookie || (roleCookie !== 'admin' && roleCookie !== 'manager' && roleCookie !== 'viewer')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { license_plate, model } = body || {};
    if (!license_plate) return NextResponse.json({ error: 'Missing license_plate' }, { status: 400 });

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
    const { data, error } = await admin.from('vehicles').insert({ license_plate: normalizedPlate, model }).select('*').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, data }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Internal server error' }, { status: 500 });
  }
}


