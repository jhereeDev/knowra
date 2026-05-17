import { NextResponse } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { cardBatchResponseSchema, type Card, type WikiSummary } from '@knowra/shared';
import { articles, events, getDb } from '@knowra/db';
import { fetchMostReadSummaries, summaryToCard } from '@/lib/wikipedia';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_COUNT = 5;
const MAX_COUNT = 10;
const SEEN_LOOKBACK = 200;

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

// Returns wiki page ids the device has impressed in the last SEEN_LOOKBACK
// events. Joins events → articles because events store the local article
// id (bigint) but Wikipedia summaries are keyed by pageid (string).
async function fetchSeenWikiIds(deviceId: string): Promise<Set<string>> {
  const db = getDb();
  const rows = await db
    .select({ wikiId: articles.wikiId })
    .from(events)
    .innerJoin(articles, eq(events.articleId, articles.id))
    .where(and(eq(events.deviceId, deviceId), eq(events.eventType, 'impression')))
    .orderBy(desc(events.occurredAt))
    .limit(SEEN_LOOKBACK);
  return new Set(rows.map((r) => r.wikiId));
}

// Fisher-Yates shuffle. Keeps trending varied even when the impression
// dedup hasn't filtered enough — without this, the deterministic Wikipedia
// ranking returns the same head over and over.
function shuffle<T>(arr: T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
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

  // Shuffle within the fresh pool so repeat calls don't return the same
  // top-N of yesterday's deterministic ranking. We still prefer the freshest
  // candidates over the unfiltered ranked pool — if every fresh article is
  // exhausted, fall back to a shuffle of the whole pool rather than 502.
  const chosen = (candidates.length > 0 ? shuffle(candidates) : shuffle(pool)).slice(0, count);

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
