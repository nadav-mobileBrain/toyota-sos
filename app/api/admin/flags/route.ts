import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { listFlags, setFlag } from './handler';

export async function GET() {
  const cookieStore = await cookies();
  const role = cookieStore.get('toyota_role')?.value;
  if (!role || (role !== 'admin' && role !== 'manager')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const res = await listFlags();
  return NextResponse.json(res.body as any, { status: res.status });
}

export async function PUT(req: NextRequest) {
  const cookieStore = await cookies();
  const role = cookieStore.get('toyota_role')?.value;
  const actorId = cookieStore.get('toyota_user_id')?.value || null;
  if (!role || (role !== 'admin' && role !== 'manager')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { key, enabled } = await req.json().catch(() => ({}));
  if (typeof key !== 'string' || typeof enabled !== 'boolean') {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
  const res = await setFlag(key, enabled, actorId);
  return NextResponse.json(res.body as any, { status: res.status });
}


