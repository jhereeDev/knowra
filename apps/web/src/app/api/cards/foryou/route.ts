import { NextResponse } from 'next/server';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { cardBatchResponseSchema, type Card } from '@knowra/shared';
import { articles, events, getDb } from '@knowra/db';
import {
  fetchRandomSummary,
  fetchRelatedSummaries,
  summaryToCard,
  type WikipediaError,
} from '@/lib/wikipedia';
import type { WikiSummary } from '@knowra/shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_COUNT = 5;
const MAX_COUNT = 10;
const SEEDS_LOOKBACK = 30; // how many recent positive events to consider
const SEEDS_TO_USE = 3; // distinct engagement-seed articles per request
const SEEN_LOOKBACK = 200; // dedupe against last N impressions for this device
const EXPLORATION_FRACTION = 0.15;
const POSITIVE_EVENT_TYPES = ['save', 'go_deeper'] as const;
const LONG_DWELL_MS = 5000; // swipe_up with dwell beyond this is a positive too
const MAX_TOPIC_SEEDS = 3; // how many topic prefs to seed from per request
// Map a lowercase topic header value → the Wikipedia article title we
// use as a seed. The article's related-pages give us topic-flavored
// candidates. Title-cased / specific where Wikipedia disambiguates.
const TOPIC_TO_SEED_TITLE: Record<string, string> = {
  history: 'History',
  science: 'Science',
  technology: 'Technology',
  art: 'Art',
  music: 'Music',
  literature: 'Literature',
  film: 'Film',
  sports: 'Sport',
  nature: 'Nature',
  geography: 'Geography',
  politics: 'Politics',
  philosophy: 'Philosophy',
  religion: 'Religion',
  food: 'Food',
  architecture: 'Architecture',
  mathematics: 'Mathematics',
  medicine: 'Medicine',
  space: 'Outer space',
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = out[i];
    const other = out[j];
    if (tmp === undefined || other === undefined) continue;
    out[i] = other;
    out[j] = tmp;
  }
  return out;
}

// Look up the last N positive engagement events for a device and return
// the titles of distinct seed articles, plus the set of wiki_ids the
// device has already seen (so we can dedupe).
async function getSeedsAndSeen(deviceId: string): Promise<{
  seedTitles: string[];
  seenWikiIds: Set<string>;
}> {
  const db = getDb();

  // Recent positive events (saves, go-deepers, long-dwell swipes).
  const positive = await db
    .select({ articleId: events.articleId, eventType: events.eventType, dwellMs: events.dwellMs })
    .from(events)
    .where(eq(events.deviceId, deviceId))
    .orderBy(desc(events.occurredAt))
    .limit(SEEDS_LOOKBACK);

  const positiveArticleIds = positive
    .filter(
      (e) =>
        POSITIVE_EVENT_TYPES.includes(
          e.eventType as (typeof POSITIVE_EVENT_TYPES)[number],
        ) ||
        (e.eventType === 'swipe_up' && (e.dwellMs ?? 0) >= LONG_DWELL_MS),
    )
    .map((e) => e.articleId);

  // Recent impressions — broader set; used for dedupe.
  const recentImpressions = await db
    .select({ articleId: events.articleId })
    .from(events)
    .where(and(eq(events.deviceId, deviceId), eq(events.eventType, 'impression')))
    .orderBy(desc(events.occurredAt))
    .limit(SEEN_LOOKBACK);

  const seenIds = new Set(recentImpressions.map((r) => String(r.articleId)));

  if (positiveArticleIds.length === 0) {
    return { seedTitles: [], seenWikiIds: seenIds };
  }

  const uniqueIds = Array.from(new Set(positiveArticleIds)).slice(0, SEEDS_TO_USE);
  const seedRows = await db
    .select({ title: articles.title, wikiId: articles.wikiId })
    .from(articles)
    .where(inArray(articles.id, uniqueIds));

  return {
    seedTitles: seedRows.map((r) => r.title),
    seenWikiIds: seenIds,
  };
}

function parseTopicSeeds(header: string | null): string[] {
  if (!header) return [];
  return header
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
    .map((t) => TOPIC_TO_SEED_TITLE[t])
    .filter((title): title is string => Boolean(title))
    .slice(0, MAX_TOPIC_SEEDS);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const lang = url.searchParams.get('lang') ?? 'en';
  const requested = Number.parseInt(url.searchParams.get('count') ?? String(DEFAULT_COUNT), 10);
  const count = Number.isFinite(requested) ? clamp(requested, 1, MAX_COUNT) : DEFAULT_COUNT;
  const deviceId = request.headers.get('x-knowra-device-id');
  const topicSeedTitles = parseTopicSeeds(request.headers.get('x-knowra-topics'));

  // No device id and no topics → nothing to personalize on.
  if (!deviceId && topicSeedTitles.length === 0) {
    return coldFallback(lang, count, 'no_device');
  }

  let seeds = { seedTitles: [] as string[], seenWikiIds: new Set<string>() };
  if (deviceId) {
    try {
      seeds = await getSeedsAndSeen(deviceId);
    } catch (err) {
      console.warn('[foryou] seed query failed, continuing with topics only', err);
    }
  }

  // Combine engagement seeds + topic seeds (topics take the back seat
  // when engagement signal exists; they're the only signal when it doesn't).
  const allSeedTitles = [...seeds.seedTitles, ...topicSeedTitles];
  if (allSeedTitles.length === 0) {
    return coldFallback(lang, count, 'no_signal');
  }

  // Fan out: fetch related pages for each seed in parallel.
  const relatedResults = await Promise.allSettled(
    allSeedTitles.map((title) => fetchRelatedSummaries(title, lang)),
  );

  // Flatten + dedupe by pageid, filter out already-seen articles.
  const candidates: WikiSummary[] = [];
  const candidateIds = new Set<number>();
  for (const r of relatedResults) {
    if (r.status !== 'fulfilled') continue;
    for (const s of r.value) {
      if (candidateIds.has(s.pageid)) continue;
      if (seeds.seenWikiIds.has(String(s.pageid))) continue;
      candidateIds.add(s.pageid);
      candidates.push(s);
    }
  }

  // Carve out an exploration slot: 15% (rounded up, min 1 if count >= 4).
  const explorationSlots = count >= 4 ? Math.max(1, Math.round(count * EXPLORATION_FRACTION)) : 0;
  const personalizedSlots = count - explorationSlots;

  const personalized = shuffle(candidates).slice(0, personalizedSlots);

  // Fill exploration + any shortfall from personalized with fresh random picks.
  const shortfall = personalizedSlots - personalized.length;
  const explorationCount = explorationSlots + Math.max(0, shortfall);
  const explorationSummaries: WikiSummary[] = [];
  for (let i = 0; i < explorationCount; i++) {
    try {
      const s = await fetchRandomSummary(lang);
      if (s.type === 'disambiguation' || !s.extract?.trim()) continue;
      if (candidateIds.has(s.pageid)) continue;
      if (seeds.seenWikiIds.has(String(s.pageid))) continue;
      candidateIds.add(s.pageid);
      explorationSummaries.push(s);
    } catch {
      // ignore; we'll just return fewer
    }
  }

  const merged = shuffle([...personalized, ...explorationSummaries]).slice(0, count);
  if (merged.length === 0) {
    return coldFallback(lang, count, 'empty_pool');
  }

  const cards: Card[] = await Promise.all(merged.map((s) => summaryToCard(s)));
  const body = cardBatchResponseSchema.parse({ cards });
  return NextResponse.json(body);
}

async function coldFallback(
  lang: string,
  count: number,
  reason: string,
): Promise<Response> {
  const summaries: WikiSummary[] = [];
  for (let i = 0; i < count * 2 && summaries.length < count; i++) {
    try {
      const s = await fetchRandomSummary(lang);
      if (s.type === 'disambiguation' || !s.extract?.trim()) continue;
      summaries.push(s);
    } catch (e) {
      const err = e as WikipediaError;
      if (err.status && err.status >= 400 && err.status < 500) break;
    }
  }
  if (summaries.length === 0) {
    return NextResponse.json(
      { error: { code: 'WIKIPEDIA_FETCH_FAILED', message: `cold_fallback:${reason}` } },
      { status: 502 },
    );
  }
  const cards: Card[] = await Promise.all(summaries.map((s) => summaryToCard(s)));
  const res = NextResponse.json(cardBatchResponseSchema.parse({ cards }));
  res.headers.set('x-knowra-fallback', reason);
  // satisfy unused-symbol lints if sql/eq aren't referenced elsewhere
  void sql;
  void eq;
  return res;
}
