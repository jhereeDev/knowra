import { after } from 'next/server';
import { eq } from 'drizzle-orm';
import { wikiSummarySchema, type Card, type WikiSummary } from '@knowra/shared';
import { articles, getDb, images } from '@knowra/db';
import { extractImageMetadata } from './imageMetadata';
import { isConfigured as cfConfigured, pickVariant, uploadImageByUrl } from './cloudflareImages';
import { generateHook } from './hooks';
import { classifyTopics } from './classify';
import { CACHE_TTL, getOrSet } from './cache';

// Background-fill the dominant color + blurhash (and CDN URLs if CF is
// configured) for an images row whose initial insert had nulls. Called
// via after() so the user gets the card immediately with the default
// dark background; the next time anyone fetches this article, the
// color, blurhash, and CDN URLs are there.
function scheduleImageEnrichment(imageId: number, sampleUrl: string, fullUrl: string): void {
  after(async () => {
    const db = getDb();

    // Run color/blurhash extraction and CF upload in parallel — they
    // hit different endpoints and don't share intermediate state.
    const [meta, cf] = await Promise.all([
      extractImageMetadata(sampleUrl),
      cfConfigured() ? uploadImageByUrl(fullUrl, { source: 'wikipedia' }) : Promise.resolve(null),
    ]);

    // Only set fields that succeeded — never overwrite good data with null.
    const patch: Record<string, unknown> = {};
    if (meta.dominantColor) patch.dominantColor = meta.dominantColor;
    if (meta.blurhash) patch.blurhash = meta.blurhash;
    if (cf) {
      const v720 = pickVariant(cf.variantUrls, 720);
      const v1080 = pickVariant(cf.variantUrls, 1080);
      const v1440 = pickVariant(cf.variantUrls, 1440);
      if (v720) patch.cdnUrl720 = v720;
      if (v1080) patch.cdnUrl1080 = v1080;
      if (v1440) patch.cdnUrl1440 = v1440;
    }
    if (Object.keys(patch).length === 0) return;
    await db.update(images).set(patch).where(eq(images.id, imageId));
  });
}

const REST_BASE = 'https://{lang}.wikipedia.org/api/rest_v1';

const SLUG_MAX = 80;
function slugify(title: string, wikiId: string): string {
  const base = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX);
  return base ? `${base}-${wikiId}` : `wiki-${wikiId}`;
}

function userAgent(): string {
  return (
    process.env.WIKIPEDIA_USER_AGENT ??
    'Knowra/0.1 (contact: dev@knowra.space)'
  );
}

export class WikipediaError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'WikipediaError';
  }
}

export async function fetchRandomSummary(lang = 'en'): Promise<WikiSummary> {
  const url = `${REST_BASE.replace('{lang}', lang)}/page/random/summary`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': userAgent(),
      Accept: 'application/json; charset=utf-8; profile="https://www.mediawiki.org/wiki/Specs/Summary/1.4.2"',
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new WikipediaError(
      `Wikipedia REST summary failed: ${res.status} ${res.statusText}`,
      res.status,
    );
  }
  const raw: unknown = await res.json();
  return wikiSummarySchema.parse(raw);
}

// Wikimedia core REST: full-text search across Wikipedia pages. Returns
// titles + descriptions (no full summary) — meant for an autocomplete UX.
// Spec: https://api.wikimedia.org/wiki/Core_REST_API/Reference/Search/Search_pages
export type WikiSearchResult = {
  wikiId: string;
  title: string;
  description: string | null;
  thumbnail: { url: string; width: number; height: number } | null;
};

export async function searchWikipedia(
  q: string,
  lang = 'en',
  limit = 10,
): Promise<WikiSearchResult[]> {
  const trimmed = q.trim();
  if (!trimmed) return [];
  const cap = Math.min(limit, 20);
  // Cached because the same queries repeat across users ("apollo 11",
  // "world cup"). Key normalizes case + collapses whitespace so
  // "Apollo 11" and "apollo  11" share an entry.
  const cacheKey = `wikipedia:search:${lang}:${cap}:${trimmed.toLowerCase().replace(/\s+/g, ' ')}`;
  return getOrSet(cacheKey, CACHE_TTL.search, () => searchWikipediaUncached(trimmed, lang, cap));
}

async function searchWikipediaUncached(
  trimmed: string,
  lang: string,
  cap: number,
): Promise<WikiSearchResult[]> {
  const url = `https://api.wikimedia.org/core/v1/wikipedia/${lang}/search/page?q=${encodeURIComponent(
    trimmed,
  )}&limit=${cap}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': userAgent() },
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new WikipediaError(
      `Wikipedia search failed: ${res.status} ${res.statusText}`,
      res.status,
    );
  }
  const raw = (await res.json()) as {
    pages?: Array<{
      id?: number;
      key?: string;
      title?: string;
      description?: string | null;
      thumbnail?: { url: string; width?: number; height?: number } | null;
    }>;
  };
  const out: WikiSearchResult[] = [];
  for (const p of raw.pages ?? []) {
    if (typeof p.id !== 'number' || typeof p.title !== 'string') continue;
    out.push({
      wikiId: String(p.id),
      title: p.title,
      description: p.description ?? null,
      thumbnail: p.thumbnail
        ? {
            // Thumbnail URLs from the search API are protocol-relative
            // (e.g. "//upload.wikimedia.org/...") — prepend https:.
            url: p.thumbnail.url.startsWith('//')
              ? `https:${p.thumbnail.url}`
              : p.thumbnail.url,
            width: p.thumbnail.width ?? 64,
            height: p.thumbnail.height ?? 64,
          }
        : null,
    });
  }
  return out;
}

// Wikipedia REST: /feed/featured/{yyyy}/{mm}/{dd} returns the featured
// article, most-read articles (yesterday), image of the day, and on-this-day
// items. We pull `mostread.articles[]` — that's the "trending" feed.
// Spec: https://en.wikipedia.org/api/rest_v1/#/Feed/aggregatedFeed
export async function fetchMostReadSummaries(
  lang = 'en',
  date = new Date(Date.now() - 86_400_000), // yesterday — today's data isn't aggregated yet
): Promise<WikiSummary[]> {
  const yyyy = String(date.getUTCFullYear());
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  // Cached because Wikipedia's most-read for a past date is stable —
  // calling it 100 times per minute just because users hit "Trending"
  // wastes a round-trip and risks rate limits. TTL is hours, not days,
  // to absorb any late-arriving aggregation updates.
  const cacheKey = `wikipedia:mostread:${lang}:${yyyy}-${mm}-${dd}`;
  return getOrSet(cacheKey, CACHE_TTL.mostRead, async () => {
    const url = `${REST_BASE.replace('{lang}', lang)}/feed/featured/${yyyy}/${mm}/${dd}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': userAgent() },
      cache: 'no-store',
    });
    if (!res.ok) {
      throw new WikipediaError(
        `Wikipedia featured failed: ${res.status} ${res.statusText}`,
        res.status,
      );
    }
    const raw: unknown = await res.json();
    const data = raw as { mostread?: { articles?: unknown[] } };
    const out: WikiSummary[] = [];
    const seen = new Set<number>();
    for (const p of data.mostread?.articles ?? []) {
      const parsed = wikiSummarySchema.safeParse(p);
      if (!parsed.success) continue;
      if (parsed.data.type === 'disambiguation') continue;
      if (!parsed.data.extract?.trim()) continue;
      if (seen.has(parsed.data.pageid)) continue;
      seen.add(parsed.data.pageid);
      out.push(parsed.data);
    }
    return out;
  });
}

// Wikipedia REST: /page/related/{title} returns up to ~20 articles related
// to the given page, each with a full summary object. Used by the For You
// feed to seed recommendations from articles the user has engaged with.
// Spec: https://en.wikipedia.org/api/rest_v1/#/Page_content/get_page_related__title_
export async function fetchRelatedSummaries(
  title: string,
  lang = 'en',
): Promise<WikiSummary[]> {
  const encoded = encodeURIComponent(title);
  const url = `${REST_BASE.replace('{lang}', lang)}/page/related/${encoded}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': userAgent() },
    cache: 'no-store',
  });
  if (!res.ok) {
    // 404 on related is common for very obscure articles; treat as empty
    // rather than throwing — caller can fall back to other seeds.
    if (res.status === 404) return [];
    throw new WikipediaError(
      `Wikipedia related failed: ${res.status} ${res.statusText}`,
      res.status,
    );
  }
  const raw: unknown = await res.json();
  const data = raw as { pages?: unknown[] };
  const out: WikiSummary[] = [];
  const seen = new Set<number>();
  for (const p of data.pages ?? []) {
    const parsed = wikiSummarySchema.safeParse(p);
    if (!parsed.success) continue;
    if (parsed.data.type === 'disambiguation') continue;
    if (!parsed.data.extract?.trim()) continue;
    if (seen.has(parsed.data.pageid)) continue;
    seen.add(parsed.data.pageid);
    out.push(parsed.data);
  }
  return out;
}

// Wikipedia "on this day" feed — returns events, births, deaths, holidays,
// and a curated `selected` list for the given month/day. Each entry has a
// `text` blurb and a `pages` array of full summary objects.
// Spec: https://en.wikipedia.org/api/rest_v1/#/Feed/onThisDay
export async function fetchOnThisDaySummaries(
  lang = 'en',
  date = new Date(),
): Promise<WikiSummary[]> {
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  // Cached because the on-this-day list for MM-DD is stable for the
  // calendar day. Key includes only MM-DD so all years map to the same
  // entry (which is what the Wikipedia endpoint returns anyway).
  const cacheKey = `wikipedia:onthisday:${lang}:${mm}-${dd}`;
  return getOrSet(cacheKey, CACHE_TTL.onThisDay, async () => {
    const url = `${REST_BASE.replace('{lang}', lang)}/feed/onthisday/all/${mm}/${dd}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': userAgent() },
      cache: 'no-store',
    });
    if (!res.ok) {
      throw new WikipediaError(
        `Wikipedia onthisday failed: ${res.status} ${res.statusText}`,
        res.status,
      );
    }
    const raw: unknown = await res.json();
    // The on-this-day payload is a record of category → entry[]; each entry
    // has a `pages` array whose items match our wikiSummarySchema. We pull
    // pages from `selected` (curated) and `events` (broader) for breadth.
    const data = raw as {
      selected?: Array<{ pages?: unknown[] }>;
      events?: Array<{ pages?: unknown[] }>;
    };
    const rawPages = [
      ...(data.selected ?? []).flatMap((e) => e.pages ?? []),
      ...(data.events ?? []).flatMap((e) => e.pages ?? []),
    ];
    const summaries: WikiSummary[] = [];
    const seen = new Set<number>();
    for (const p of rawPages) {
      const parsed = wikiSummarySchema.safeParse(p);
      if (!parsed.success) continue;
      if (seen.has(parsed.data.pageid)) continue;
      if (parsed.data.type === 'disambiguation') continue;
      if (!parsed.data.extract?.trim()) continue;
      seen.add(parsed.data.pageid);
      summaries.push(parsed.data);
    }
    return summaries;
  });
}

// Wikipedia action API: fetch the full plaintext extract for an article by
// page id. The REST summary endpoint's `extract` field is truncated for
// preview use; this endpoint returns the full article body in plaintext,
// which we feed to the LLM summarizer. We truncate to ~3000 chars before
// returning so input cost to the model stays predictable.
// Spec: https://www.mediawiki.org/wiki/Extension:TextExtracts
const EXTRACT_MAX_CHARS = 3000;
export async function fetchArticleExtract(
  pageId: string,
  lang = 'en',
): Promise<string> {
  const url =
    `https://${lang}.wikipedia.org/w/api.php` +
    `?action=query&format=json&formatversion=2` +
    `&prop=extracts&explaintext=1&exsectionformat=plain` +
    `&pageids=${encodeURIComponent(pageId)}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': userAgent() },
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new WikipediaError(
      `Wikipedia extract failed: ${res.status} ${res.statusText}`,
      res.status,
    );
  }
  const raw = (await res.json()) as {
    query?: { pages?: Array<{ extract?: string; missing?: boolean }> };
  };
  const page = raw.query?.pages?.[0];
  if (!page || page.missing) return '';
  const extract = (page.extract ?? '').trim();
  if (extract.length <= EXTRACT_MAX_CHARS) return extract;
  // Cut on a sentence boundary inside the cap so the LLM doesn't see a
  // mid-word truncation. Falls back to the hard cap if no period is found.
  const slice = extract.slice(0, EXTRACT_MAX_CHARS);
  const lastBoundary = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('.\n'));
  return lastBoundary > EXTRACT_MAX_CHARS * 0.6
    ? slice.slice(0, lastBoundary + 1)
    : slice;
}

type ImageUpsertResult = {
  id: number;
  url: string;
  width: number;
  height: number;
  dominantColor: string | null;
};

// Upsert an images row for the hero image of a Wikipedia article. Returns
// the local id and rendering metadata. Two-tier perf:
//   1. If we already have this image cached AND it has a dominant_color,
//      return it immediately — no DB write, no extraction.
//   2. If new, insert with null color and schedule extraction via after()
//      so the card lands fast; the color fills in on the next fetch.
async function upsertHeroImage(summary: WikiSummary): Promise<ImageUpsertResult | null> {
  const img = summary.originalimage ?? summary.thumbnail;
  if (!img) return null;

  const db = getDb();
  const sampleUrl = summary.thumbnail?.source ?? img.source;

  // Fast path: image already cached with a color.
  const existing = await db
    .select({
      id: images.id,
      width: images.width,
      height: images.height,
      dominantColor: images.dominantColor,
      blurhash: images.blurhash,
      cdnUrl1080: images.cdnUrl1080,
    })
    .from(images)
    .where(eq(images.sourceUrl, img.source))
    .limit(1);

  if (existing[0]) {
    const row = existing[0];
    // If something is still missing (no color, no blurhash, no CDN URL
    // when CF is configured), schedule background enrichment. This is
    // how images ingested before CF was configured get uploaded — no
    // manual backfill needed.
    const needsColor = !row.dominantColor;
    const needsBlurhash = !row.blurhash;
    const needsCdn = cfConfigured() && !row.cdnUrl1080;
    if (needsColor || needsBlurhash || needsCdn) {
      scheduleImageEnrichment(row.id, sampleUrl, img.source);
    }
    return {
      id: row.id,
      // Prefer the CDN URL when CF has uploaded it; otherwise fall back
      // to the original Wikipedia URL.
      url: row.cdnUrl1080 ?? img.source,
      width: row.width ?? img.width,
      height: row.height ?? img.height,
      dominantColor: row.dominantColor,
    };
  }

  // New image. Insert with null color, return immediately, fill the
  // color/blurhash/CDN URLs in the background. attribution is set once.
  const attribution = `Wikimedia Commons — ${summary.title}`;
  const [row] = await db
    .insert(images)
    .values({
      sourceUrl: img.source,
      width: img.width,
      height: img.height,
      attribution,
      dominantColor: null,
    })
    .onConflictDoUpdate({
      target: images.sourceUrl,
      set: { width: img.width, height: img.height, attribution },
    })
    .returning({ id: images.id, dominantColor: images.dominantColor });

  if (!row) return null;
  if (!row.dominantColor) {
    scheduleImageEnrichment(row.id, sampleUrl, img.source);
  }
  return {
    id: row.id,
    url: img.source,
    width: img.width,
    height: img.height,
    dominantColor: row.dominantColor,
  };
}

// Background-generate a Claude-written hook and persist it. Uses Next 15's
// after() so it runs once the response has been sent — the user gets the
// card immediately with the Wikipedia extract as the hook, and a few
// seconds later the row is updated to a better LLM-written hook. If
// generation returns NO_HOOK (the source was too thin), we mark
// hook_source as 'fallback' so we don't retry every time. On API/network
// error, leave hook_source null so the next fetch retries.
function scheduleHookGeneration(articleId: number, title: string, extract: string): void {
  after(async () => {
    const result = await generateHook(title, extract);
    const db = getDb();
    const now = new Date();
    if (result.kind === 'ok') {
      await db
        .update(articles)
        .set({ hook: result.hook, hookSource: 'llm', updatedAt: now })
        .where(eq(articles.id, articleId));
    } else if (result.kind === 'no_hook') {
      await db
        .update(articles)
        .set({ hookSource: 'fallback', updatedAt: now })
        .where(eq(articles.id, articleId));
    }
    // result.kind === 'error': leave hook_source null so we retry next time.
  });
}

// Upsert a minimal articles row for the given Wikipedia summary. Returns
// the local DB row id (bigint, returned as string for JSON safety) plus
// the resolved hero image record (or null if the article has no image).
export async function upsertArticleFromSummary(
  summary: WikiSummary,
): Promise<{ articleId: string; image: ImageUpsertResult | null }> {
  const db = getDb();
  const image = await upsertHeroImage(summary);

  const wikiId = String(summary.pageid);
  const lang = summary.lang ?? 'en';
  const title = summary.title;
  const slug = slugify(title, wikiId);
  const now = new Date();
  const wikipediaExtract = summary.extract ?? null;

  const topics = classifyTopics(summary.description);

  const [row] = await db
    .insert(articles)
    .values({
      wikiId,
      slug,
      lang,
      title,
      subtitle: summary.description ?? null,
      hook: wikipediaExtract,
      hookSource: wikipediaExtract ? 'wikipedia' : null,
      heroImageId: image?.id ?? null,
      categories: topics,
      status: 'ready',
    })
    .onConflictDoUpdate({
      target: articles.wikiId,
      set: {
        title,
        subtitle: summary.description ?? null,
        heroImageId: image?.id ?? null,
        categories: topics,
        updatedAt: now,
        // Deliberately not setting hook / hookSource here — preserves any
        // LLM-generated hook from a prior visit.
      },
    })
    .returning({ id: articles.id, hookSource: articles.hookSource });

  if (!row) {
    throw new Error('Article upsert returned no row');
  }

  // Schedule LLM generation only when the row hasn't already been processed.
  // hookSource === 'llm' or 'fallback' means we've already tried.
  if ((row.hookSource === null || row.hookSource === 'wikipedia') && wikipediaExtract) {
    scheduleHookGeneration(row.id, title, wikipediaExtract);
  }

  return { articleId: String(row.id), image };
}

// Wikipedia's `displaytitle` often includes HTML markup (italics for
// movie titles, `<span class="mw-page-title-main">` wrappers, etc.).
// For now we render plain text only, so strip tags. When we want
// rich title rendering we can switch to a renderer that consumes the
// markup safely.
function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

export async function summaryToCard(summary: WikiSummary): Promise<Card> {
  const wikipediaUrl =
    summary.content_urls?.desktop.page ??
    `https://${summary.lang ?? 'en'}.wikipedia.org/?curid=${summary.pageid}`;

  const { articleId, image } = await upsertArticleFromSummary(summary);

  const topics = classifyTopics(summary.description);

  return {
    articleId,
    wikiId: String(summary.pageid),
    lang: summary.lang ?? 'en',
    title: stripHtml(summary.displaytitle ?? summary.title) || summary.title,
    categories: topics,
    subtitle: summary.description ?? null,
    hook: summary.extract ?? '',
    image: image
      ? {
          url: image.url,
          width: image.width,
          height: image.height,
          dominantColor: image.dominantColor,
        }
      : null,
    wikipediaUrl,
    attribution: 'Wikipedia, CC BY-SA 4.0',
    fetchedAt: new Date().toISOString(),
  };
}

