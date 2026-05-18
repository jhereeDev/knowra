import { NextResponse } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { cardBatchResponseSchema, type Card } from '@knowra/shared';
import { events, getDb } from '@knowra/db';
import { fetchRelatedSummaries, summaryToCard } from '@/lib/wikipedia';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_COUNT = 8;
const MAX_COUNT = 15;
const SEEN_LOOKBACK = 200;

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

// GET /api/cards/region?seed=Philippines&count=10
//
// "Articles from a place" — uses Wikipedia's related-pages endpoint
// seeded by the region/country name (any Wikipedia article title).
// Returns up to `count` Card objects, deduped against the requesting
// device's recent impressions.
//
// Works equally well for countries (Philippines, Japan, Brazil), cities
// (Tokyo, Manila, Berlin), regions (Southeast Asia), or landmarks
// (Mount Fuji). Anything that has a Wikipedia article works as a seed.
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const seed = url.searchParams.get('seed')?.trim();
  if (!seed) {
    return NextResponse.json(
      { error: { code: 'bad_request', message: 'seed param required' } },
      { status: 400 },
    );
  }
  const lang = url.searchParams.get('lang') ?? 'en';
  const requested = Number.parseInt(
    url.searchParams.get('count') ?? String(DEFAULT_COUNT),
    10,
  );
  const count = Number.isFinite(requested) ? clamp(requested, 1, MAX_COUNT) : DEFAULT_COUNT;
  const deviceId = request.headers.get('x-knowra-device-id');

  let related;
  try {
    related = await fetchRelatedSummaries(seed, lang);
  } catch (err) {
    return NextResponse.json(
      {
        error: {
          code: 'wikipedia_fetch_failed',
          message: err instanceof Error ? err.message : 'unknown',
        },
      },
      { status: 502 },
    );
  }

  // Dedup against the device's recent impressions.
  let candidates = related;
  if (deviceId) {
    const db = getDb();
    const recent = await db
      .select({ articleId: events.articleId })
      .from(events)
      .where(and(eq(events.deviceId, deviceId), eq(events.eventType, 'impression')))
      .orderBy(desc(events.occurredAt))
      .limit(SEEN_LOOKBACK);
    const seen = new Set(recent.map((r) => String(r.articleId)));
    candidates = related.filter((s) => !seen.has(String(s.pageid)));
  }

  const chosen = (candidates.length > 0 ? candidates : related).slice(0, count);
  if (chosen.length === 0) {
    return NextResponse.json(
      { error: { code: 'no_cards', message: 'no related articles found' } },
      { status: 404 },
    );
  }

  const cards: Card[] = await Promise.all(chosen.map((s) => summaryToCard(s)));
  return NextResponse.json(cardBatchResponseSchema.parse({ cards }));
}
