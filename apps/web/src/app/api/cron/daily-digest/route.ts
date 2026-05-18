import { NextResponse } from 'next/server';
import { isNotNull, inArray } from 'drizzle-orm';
import { devices, getDb } from '@knowra/db';
import { pickDigestCardForDevice } from '@/lib/digest';
import { sendPushes, type ExpoPushMessage } from '@/lib/expoPush';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Vercel function timeout — fan-out across all devices can take a minute
// at scale. 60s is the default; the route is designed to fit inside it
// at MVP volume (sub-1000 devices). At larger scale, swap to an Inngest
// fan-out with one event per device.
export const maxDuration = 60;

const DEVICE_FETCH_LIMIT = 1000; // soft cap — bump when DAU outgrows it
const PER_DEVICE_CONCURRENCY = 10;

// Group an async function over an array with bounded concurrency.
// Avoids exhausting Neon's connection pool when iterating thousands of
// devices in parallel — instead processes up to `limit` at a time.
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  async function worker(): Promise<void> {
    while (cursor < items.length) {
      const idx = cursor++;
      const item = items[idx];
      if (item === undefined) continue;
      out[idx] = await fn(item);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

/**
 * Daily digest cron — fans out one push per device that has registered a
 * push token. Triggered by Vercel Cron (see apps/web/vercel.json).
 *
 * Auth: Vercel sends `Authorization: Bearer ${CRON_SECRET}`. We compare
 * against process.env.CRON_SECRET. In dev, the env var is whatever you
 * set in packages/db/.env — and you call the route with a matching header.
 *
 * Response: a small JSON summary {selected, sent, ok, failed, retiredTokens}.
 * Useful for cron observability and the per-day stats line.
 */
export async function GET(request: Request) {
  // ----- Auth ------------------------------------------------------------
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: { code: 'CONFIG', message: 'CRON_SECRET not set on server' } },
      { status: 500 },
    );
  }
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Bad cron secret' } },
      { status: 401 },
    );
  }

  // ----- Pull eligible devices ------------------------------------------
  const db = getDb();
  const rows = await db
    .select({ id: devices.id, token: devices.expoPushToken })
    .from(devices)
    .where(isNotNull(devices.expoPushToken))
    .limit(DEVICE_FETCH_LIMIT);

  if (rows.length === 0) {
    return NextResponse.json({ selected: 0, sent: 0, ok: 0, failed: 0, retiredTokens: 0 });
  }

  // ----- Pick a card per device with bounded concurrency ----------------
  const picks = await mapWithConcurrency(rows, PER_DEVICE_CONCURRENCY, async (row) => {
    try {
      const card = await pickDigestCardForDevice(row.id);
      return card && row.token ? { token: row.token, card } : null;
    } catch {
      return null;
    }
  });

  // ----- Build messages, send via Expo ----------------------------------
  const messages: ExpoPushMessage[] = [];
  for (const p of picks) {
    if (!p) continue;
    messages.push({
      to: p.token,
      title: p.card.title,
      body: p.card.hook.length > 180 ? `${p.card.hook.slice(0, 177)}…` : p.card.hook,
      data: { wikiId: p.card.wikiId },
    });
  }

  const result = await sendPushes(messages);

  // ----- Retire stale tokens (DeviceNotRegistered) -----------------------
  if (result.staleTokens.length > 0) {
    await db
      .update(devices)
      .set({ expoPushToken: null, pushOptedInAt: null })
      .where(inArray(devices.expoPushToken, result.staleTokens));
  }

  return NextResponse.json({
    selected: rows.length,
    sent: messages.length,
    ok: result.ok,
    failed: result.failed,
    retiredTokens: result.staleTokens.length,
  });
}
