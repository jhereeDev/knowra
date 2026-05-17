import { NextResponse } from 'next/server';
import { healthResponseSchema, KNOWRA_VERSION } from '@knowra/shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET() {
  const payload = healthResponseSchema.parse({
    ok: true,
    service: 'knowra-web',
    version: KNOWRA_VERSION,
    timestamp: new Date().toISOString(),
  });
  return NextResponse.json(payload);
}
