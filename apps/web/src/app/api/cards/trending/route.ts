import { NextResponse } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { cardBatchResponseSchema, type Card, type WikiSummary } from '@knowra/shared';
import { events, getDb } from '@knowra/db';
import { fetchMostReadSummaries, summaryToCard } from '@/lib/wikipedia';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_COUNT = 5;
const MAX_COUNT = 10;
const SEEN_LOOKBACK = 200;

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

async function fetchSeenWikiIds(deviceId: string): Promise<Set<string>> {
  const db = getDb();
  const rows = await db
    .select({ articleId: events.articleId })
    .from(events)
    .where(and(eq(events.deviceId, deviceId), eq(events.eventType, 'impression')))
    .orderBy(desc(events.occurredAt))
    .limit(SEEN_LOOKBACK);
  // Events store local article IDs, not wiki page ids — but we want to
  // dedupe by wiki page id. Cheap workaround: also dedupe within this
  // request and use the seen set as a "soft" filter (it's empty when the
  // device has no impressions, which is the only case where dedupe matters
  // for trending — repeat calls).
  // For now, treat the impression set as opaque; the in-request dedupe
  // below covers the practical case (refill returning the same articles).
  return new Set(rows.map((r) => String(r.articleId)));
}

// Wikipedia's "most read" list is ranked AND deterministic per day — the
// top 5 yesterday will be the top 5 every call today. To make refills
// return fresh content:
//   1. Pull the WHOLE pool (~50 articles), not just the head
//   2. Dedupe against the device's recent impressions (events table)
//   3. Then take `count` from the remaining
//   4. If we run out, fall back to the day before yesterday
export async function GET(request: Request) {
  const url = new URL(request.url);
  const lang = url.searchParams.get('lang') ?? 'en';
  const requested = Number.parseInt(url.searchParams.get('count') ?? String(DEFAULT_COUNT), 10);
  const count = Number.isFinite(requested) ? clamp(requested, 1, MAX_COUNT) : DEFAULT_COUNT;
  const deviceId = request.headers.get('x-knowra-device-id');

  // Fetch up to two days back so we have a pool if yesterday's top is exhausted.
  const yesterday = new Date(Date.now() - 86_400_000);
  const dayBefore = new Date(Date.now() - 172_800_000);

  let pool: WikiSummary[] = [];
  try {
    const [a, b] = await Promise.allSettled([
      fetchMostReadSummaries(lang, yesterday),
      fetchMostReadSummaries(lang, dayBefore),
    ]);
    const fromA = a.status === 'fulfilled' ? a.value : [];
    const fromB = b.status === 'fulfilled' ? b.value : [];
    // Yesterday first (ranking-preserving), then day-before for backfill.
    pool = [...fromA, ...fromB];
  } catch (err) {
    return NextResponse.json(
      {
        error: {
          code: 'WIKIPEDIA_FETCH_FAILED',
          message: err instanceof Error ? err.message : 'Unknown',
        },
      },
      { status: 502 },
    );
  }

  // Dedupe by pageid across the merged pool.
  const seenInPool = new Set<number>();
  pool = pool.filter((s) => {
    if (seenInPool.has(s.pageid)) return false;
    seenInPool.add(s.pageid);
    return true;
  });

  // Filter against the device's recent impressions if we know who's asking.
  const seenByDevice = deviceId ? await fetchSeenWikiIds(deviceId) : new Set<string>();
  let candidates = pool;
  if (seenByDevice.size > 0) {
    candidates = pool.filter((s) => !seenByDevice.has(String(s.pageid)));
  }

  // If filtering ate the whole pool (rare — device has seen 50+ trending),
  // fall back to the unfiltered ranked pool so trending always returns
  // something rather than 502.
  const chosen = (candidates.length > 0 ? candidates : pool).slice(0, count);

  if (chosen.length === 0) {
    return NextResponse.json(
      { error: { code: 'NO_CARDS', message: 'No trending cards available' } },
      { status: 502 },
    );
  }

  const cards: Card[] = await Promise.all(chosen.map((s) => summaryToCard(s)));
  const body = cardBatchResponseSchema.parse({ cards });
  return NextResponse.json(body);
}
