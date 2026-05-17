import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { eventBatchRequestSchema } from '@knowra/shared';
import { devices, events, getDb } from '@knowra/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: 'INVALID_JSON', message: 'Body must be JSON' } },
      { status: 400 },
    );
  }

  const parsed = eventBatchRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: 'INVALID_BODY',
          message: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
        },
      },
      { status: 400 },
    );
  }

  const { deviceId, events: incoming } = parsed.data;
  const db = getDb();
  const now = new Date();

  // Upsert the device row — bumps last_seen_at on every batch.
  await db
    .insert(devices)
    .values({ id: deviceId, lastSeenAt: now })
    .onConflictDoUpdate({
      target: devices.id,
      set: { lastSeenAt: now },
    });

  // Bulk insert events. article_id is a bigint; values come in as string
  // from JSON and Postgres coerces text → bigint when wrapped in sql.
  // (Drizzle's bigint column accepts number or bigint at the type level.)
  await db.insert(events).values(
    incoming.map((e) => ({
      deviceId,
      articleId: sql<number>`${e.articleId}::bigint`,
      eventType: e.eventType,
      dwellMs: e.dwellMs ?? null,
      occurredAt: new Date(e.occurredAt),
    })),
  );

  return new NextResponse(null, { status: 204 });
}
