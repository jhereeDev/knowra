import { NextResponse } from 'next/server';
import { z } from 'zod';
import { devices, getDb } from '@knowra/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Expo push tokens look like "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]".
const bodySchema = z.object({
  token: z.string().regex(/^ExponentPushToken\[.+\]$/, 'Invalid Expo push token'),
});

export async function POST(request: Request) {
  const deviceId = request.headers.get('x-knowra-device-id');
  if (!deviceId) {
    return NextResponse.json(
      { error: { code: 'MISSING_DEVICE', message: 'X-Knowra-Device-Id header required' } },
      { status: 400 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: 'INVALID_JSON', message: 'Body must be JSON' } },
      { status: 400 },
    );
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'INVALID_BODY', message: parsed.error.issues[0]?.message ?? 'Invalid' } },
      { status: 400 },
    );
  }

  const db = getDb();
  const now = new Date();
  await db
    .insert(devices)
    .values({
      id: deviceId,
      lastSeenAt: now,
      expoPushToken: parsed.data.token,
      pushOptedInAt: now,
    })
    .onConflictDoUpdate({
      target: devices.id,
      set: {
        lastSeenAt: now,
        expoPushToken: parsed.data.token,
        pushOptedInAt: now,
      },
    });

  return new NextResponse(null, { status: 204 });
}
