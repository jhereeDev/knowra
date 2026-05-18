import { and, desc, eq } from 'drizzle-orm';
import type { Card, WikiSummary } from '@knowra/shared';
import { articles, events, getDb } from '@knowra/db';
import {
  fetchOnThisDaySummaries,
  fetchRandomSummary,
  summaryToCard,
} from './wikipedia';

const SEEN_LOOKBACK = 200; // dedupe digest pick against recent impressions
const RANDOM_FALLBACK_ATTEMPTS = 5;

// Wiki page ids the device has impressed recently. Joining on articles
// gives us the wiki_id (Wikipedia's pageid as a string), which is what
// WikiSummary.pageid maps to — clean dedupe key.
async function getSeenWikiIds(deviceId: string): Promise<Set<string>> {
  const db = getDb();
  const rows = await db
    .select({ wikiId: articles.wikiId })
    .from(events)
    .innerJoin(articles, eq(articles.id, events.articleId))
    .where(and(eq(events.deviceId, deviceId), eq(events.eventType, 'impression')))
    .orderBy(desc(events.occurredAt))
    .limit(SEEN_LOOKBACK);
  return new Set(rows.map((r) => r.wikiId));
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

/**
 * Pick the single card to send a device in today's daily digest.
 *
 * Per product spec §4.5: "Always includes one 'On this day' card."
 * For MVP we send exactly one card and it's always an On This Day pick
 * the device hasn't seen. Fallback is a random unseen article so the
 * push never goes empty if Wikipedia's OTD feed runs thin.
 *
 * Returns null only if every fetch path also fails — the caller should
 * treat that as "skip this device today" rather than a hard error.
 */
export async function pickDigestCardForDevice(
  deviceId: string,
  lang = 'en',
): Promise<Card | null> {
  const seen = await getSeenWikiIds(deviceId).catch(() => new Set<string>());

  // Primary path — today's On This Day pool, shuffled so two adjacent
  // devices don't get the same card.
  try {
    const pool = await fetchOnThisDaySummaries(lang);
    const shuffled = shuffle(pool);
    const pick = shuffled.find((s) => !seen.has(String(s.pageid)));
    if (pick) return await summaryToCard(pick);
  } catch {
    // fall through to random
  }

  // Fallback — random unseen article. Limited attempts so we don't loop
  // forever if Wikipedia keeps returning seen ones (extremely unlikely
  // at the 200-impression lookback).
  for (let i = 0; i < RANDOM_FALLBACK_ATTEMPTS; i++) {
    try {
      const s: WikiSummary = await fetchRandomSummary(lang);
      if (s.type === 'disambiguation' || !s.extract?.trim()) continue;
      if (seen.has(String(s.pageid))) continue;
      return await summaryToCard(s);
    } catch {
      // try again
    }
  }

  return null;
}
