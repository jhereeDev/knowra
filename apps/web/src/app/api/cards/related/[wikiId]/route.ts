import { NextResponse } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { cardBatchResponseSchema, type Card } from '@knowra/shared';
import { articles, events, getDb } from '@knowra/db';
import { fetchRelatedSummaries, summaryToCard } from '@/lib/wikipedia';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_COUNT = 6;
const MAX_COUNT = 12;
const SEEN_LOOKBACK = 200;

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

// "More like this" — finds the article in our DB by wiki_id, calls
// Wikipedia's /page/related/{title} from there, dedupes against the
// device's recent impressions, and returns up to `count` cards. Used by
// the in-app reader's "More like this" CTA to inject related articles
// into the feed.
export async function GET(
  request: Request,
  ctx: { params: Promise<{ wikiId: string }> },
) {
  const { wikiId } = await ctx.params;
  const url = new URL(request.url);
  const lang = url.searchParams.get('lang') ?? 'en';
  const requested = Number.parseInt(url.searchParams.get('count') ?? String(DEFAULT_COUNT), 10);
  const count = Number.isFinite(requested) ? clamp(requested, 1, MAX_COUNT) : DEFAULT_COUNT;
  const deviceId = request.headers.get('x-knowra-device-id');

  const db = getDb();
  const [row] = await db
    .select({ title: articles.title })
    .from(articles)
    .where(eq(articles.wikiId, wikiId))
    .limit(1);
  if (!row) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: `No cached article for wikiId ${wikiId}` } },
      { status: 404 },
    );
  }

  let related;
  try {
    related = await fetchRelatedSummaries(row.title, lang);
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

  // Dedupe against the device's recent impressions if known.
  let candidates = related;
  if (deviceId) {
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
      { error: { code: 'NO_CARDS', message: 'No related articles found' } },
      { status: 502 },
    );
  }

  const cards: Card[] = await Promise.all(chosen.map((s) => summaryToCard(s)));
  return NextResponse.json(cardBatchResponseSchema.parse({ cards }));
}
