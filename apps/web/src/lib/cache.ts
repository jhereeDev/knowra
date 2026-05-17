import { Redis } from '@upstash/redis';

// Lazily-constructed Redis client. Falls back to a no-op when the env
// vars aren't set, so local dev without Upstash still works — every
// `getOrSet` call just executes the fetcher.
type RedisClient = Redis;
let _redis: RedisClient | null = null;

function getRedis(): RedisClient | null {
  if (_redis) return _redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  _redis = new Redis({ url, token });
  return _redis;
}

export function isCacheEnabled(): boolean {
  return getRedis() !== null;
}

/**
 * Cache helper with read-through semantics. Returns the cached value if
 * present; otherwise runs the fetcher, caches the result with `ttlSeconds`,
 * and returns it. Cache misses don't fail the request even if Redis is
 * unreachable — the fetcher runs as a fallback.
 *
 * Use a stable key. Examples:
 *   wikipedia:mostread:en:2026-05-16
 *   wikipedia:onthisday:en:05-17
 *   wikipedia:search:en:apollo+11
 */
export async function getOrSet<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  const redis = getRedis();
  if (!redis) return fetcher();

  try {
    const cached = await redis.get<T>(key);
    if (cached !== null && cached !== undefined) return cached;
  } catch {
    // Read failure shouldn't break the request — fall through and fetch.
  }

  const value = await fetcher();

  // Fire-and-forget write. If Redis is down the request still succeeds;
  // next call just re-fetches.
  try {
    await redis.set(key, value, { ex: ttlSeconds });
  } catch {
    // Ignore — cache best-effort only.
  }

  return value;
}

/**
 * Invalidate a cache key. Used by admin endpoints or scheduled
 * refresh jobs. Never throws — best-effort like getOrSet.
 */
export async function invalidate(key: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.del(key);
  } catch {
    // Ignore.
  }
}

// Common TTLs (seconds), surface them so route files don't have to
// remember the magic numbers.
export const CACHE_TTL = {
  // Wikipedia "most read" for a given day stops changing within hours of
  // the date. Six hours gives us safe coverage across UTC date rollover
  // and lets us absorb any retroactive adjustments.
  mostRead: 6 * 60 * 60,
  // On-this-day list is keyed by MM-DD and stable for the day. 12h
  // matches typical morning/evening sessions.
  onThisDay: 12 * 60 * 60,
  // Search queries repeat across users (e.g. "Apollo 11"). 24h is safe;
  // Wikipedia titles rarely shift meaningfully day-to-day.
  search: 24 * 60 * 60,
} as const;
