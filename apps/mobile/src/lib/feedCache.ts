import * as SecureStore from 'expo-secure-store';
import { z } from 'zod';
import { cardSchema, type Card } from '@knowra/shared';
import type { FeedType } from '@/hooks/useCardFeed';

// Persisted snapshot of the head of each feed so a returning user sees
// content instantly on cold start instead of staring at a skeleton while
// the API round-trips. Same idea as Instagram / Twitter — the feed is
// never empty for someone who's used the app before.
//
// Storage choice: SecureStore. Mirrors lib/savedArticles.ts and works in
// Expo Go without a custom dev client. Once we ship a dev client, swap to
// MMKV for synchronous reads — API stays identical. Total payload is
// ~5 cards × 4 feed types ≈ 20-40 KB, well under any practical limit.

const STORAGE_KEY_PREFIX = 'knowra.feed_cache.';
const MAX_CACHED = 5;
// Stale after a day. Day-old On This Day picks are fine; week-old For You
// picks would feel like the app is offline. 24h is the right cutoff.
const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

const cachedFeedSchema = z.object({
  cards: z.array(cardSchema),
  savedAt: z.number(),
});

function keyFor(feedType: FeedType): string {
  return `${STORAGE_KEY_PREFIX}${feedType}`;
}

/**
 * Return cached cards for this feed if any are stored AND they're not
 * stale. Null on miss, corrupt entry, or expired entry. Never throws.
 */
export async function readFeedCache(feedType: FeedType): Promise<Card[] | null> {
  let raw: string | null;
  try {
    raw = await SecureStore.getItemAsync(keyFor(feedType));
  } catch {
    return null;
  }
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const result = cachedFeedSchema.safeParse(parsed);
  if (!result.success) return null;
  if (Date.now() - result.data.savedAt > STALE_AFTER_MS) return null;
  if (result.data.cards.length === 0) return null;
  return result.data.cards;
}

/**
 * Persist the first N cards of this feed. Fire-and-forget — callers
 * never need to await this. Failures are silent (the next session will
 * just miss the cache; not worth surfacing).
 */
export async function writeFeedCache(feedType: FeedType, cards: Card[]): Promise<void> {
  if (cards.length === 0) return;
  const payload = {
    cards: cards.slice(0, MAX_CACHED),
    savedAt: Date.now(),
  };
  try {
    await SecureStore.setItemAsync(keyFor(feedType), JSON.stringify(payload));
  } catch {
    // ignore — cache is best-effort
  }
}

/**
 * Wipe one feed's cache or, with no argument, all of them. Useful for
 * a future "reset experience" button in Settings or after a sign-out.
 */
export async function clearFeedCache(feedType?: FeedType): Promise<void> {
  const targets: FeedType[] = feedType
    ? [feedType]
    : ['random', 'today', 'trending', 'foryou'];
  await Promise.all(
    targets.map((t) => SecureStore.deleteItemAsync(keyFor(t)).catch(() => {})),
  );
}
