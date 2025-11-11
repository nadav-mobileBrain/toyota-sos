'use server';

import { NextRequest, NextResponse } from 'next/server';
import { notify, NotifyBody } from './handler';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as NotifyBody;
    if (!body || !Array.isArray(body.recipients) || !body.type) {
      return NextResponse.json(
        { ok: false, error: 'invalid-request' },
        { status: 400 }
      );
    }
    const result = await notify(body);
    if (!result.ok) {
      const status = result.error === 'invalid-request' ? 400 : 500;
      return NextResponse.json(result, { status });
    }
    return NextResponse.json(result);
  } catch (e: unknown) {
    const error = e instanceof Error ? e : new Error('Unknown error');
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}
