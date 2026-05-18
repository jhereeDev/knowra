import { NextResponse } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { syncStateResponseSchema } from '@knowra/shared';
import {
  articles,
  collectionItems,
  collections,
  getDb,
  images,
  users,
} from '@knowra/db';
import { getOrCreateUser } from '@/lib/clerkUser';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/sync/state — pull the user's cloud state. Used when a fresh
// device signs in and wants to hydrate its local SecureStore from the
// server snapshot.
export async function GET(): Promise<Response> {
  const user = await getOrCreateUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: 'unauthorized', message: 'sign in required' } },
      { status: 401 },
    );
  }

  const db = getDb();
  const userRow = (
    await db
      .select({
        topicPrefs: users.topicPrefs,
        streakCount: users.streakCount,
        streakLastDay: users.streakLastDay,
      })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1)
  )[0];

  // All collections for the user (including the synthetic __all_saved__).
  const userCollections = await db
    .select({
      id: collections.id,
      name: collections.name,
      createdAt: collections.createdAt,
    })
    .from(collections)
    .where(eq(collections.userId, user.id));

  // Join collection_items → articles → images so we can reconstitute
  // a Card snapshot for each saved entry, mirroring the local shape.
  const allCollectionIds = userCollections.map((c) => c.id);
  const itemsByCollection = new Map<string, string[]>();
  const savedCardRows: Array<{
    collectionId: string;
    articleId: number;
    wikiId: string;
    lang: string | null;
    title: string;
    subtitle: string | null;
    hook: string | null;
    wikipediaUrl: string | null;
    sourceUrl: string | null;
    width: number | null;
    height: number | null;
    dominantColor: string | null;
    categories: string[];
    addedAt: Date | null;
  }> = [];

  if (allCollectionIds.length > 0) {
    const rows = await db
      .select({
        collectionId: collectionItems.collectionId,
        articleId: articles.id,
        wikiId: articles.wikiId,
        lang: articles.lang,
        title: articles.title,
        subtitle: articles.subtitle,
        hook: articles.hook,
        // Reconstruct the desktop Wikipedia URL from wiki_id. The articles
        // table doesn't store it because it's derivable, but the local
        // Card schema requires it.
        wikipediaUrl: sql<string>`'https://' || COALESCE(${articles.lang}, 'en')
          || '.wikipedia.org/wiki/' || ${articles.wikiId}`,
        sourceUrl: images.sourceUrl,
        width: images.width,
        height: images.height,
        dominantColor: images.dominantColor,
        categories: articles.categories,
        addedAt: collectionItems.addedAt,
      })
      .from(collectionItems)
      .innerJoin(articles, eq(collectionItems.articleId, articles.id))
      .leftJoin(images, eq(articles.heroImageId, images.id))
      .where(
        sql`${collectionItems.collectionId} IN
          (SELECT id FROM ${collections} WHERE ${collections.userId} = ${user.id})`,
      );
    for (const r of rows) {
      const collectionIdStr = r.collectionId;
      const list = itemsByCollection.get(collectionIdStr) ?? [];
      list.push(String(r.articleId));
      itemsByCollection.set(collectionIdStr, list);
      savedCardRows.push({
        collectionId: collectionIdStr,
        articleId: r.articleId,
        wikiId: r.wikiId,
        lang: r.lang,
        title: r.title,
        subtitle: r.subtitle,
        hook: r.hook,
        wikipediaUrl: r.wikipediaUrl,
        sourceUrl: r.sourceUrl,
        width: r.width,
        height: r.height,
        dominantColor: r.dominantColor,
        categories: r.categories ?? [],
        addedAt: r.addedAt,
      });
    }
  }

  // Identify the synthetic __all_saved__ collection — its members are
  // the flat saved list.
  const allCollection = userCollections.find((c) => c.name === '__all_saved__');
  const userNamedCollections = userCollections.filter((c) => c.name !== '__all_saved__');

  // Build the saved-entry array, deduping by articleId. Prefer rows
  // from __all_saved__ (those are the canonical entries); fall back to
  // any other collection's row for articles that only live in named
  // collections.
  const seen = new Set<string>();
  const entries: Array<{
    card: {
      articleId: string;
      wikiId: string;
      lang: string;
      title: string;
      subtitle: string | null;
      hook: string;
      image: {
        url: string;
        width: number;
        height: number;
        dominantColor: string | null;
      } | null;
      categories: string[];
      wikipediaUrl: string;
      attribution: string;
      fetchedAt: string;
    };
    savedAt: string;
  }> = [];

  // Pass 1: __all_saved__
  for (const r of savedCardRows) {
    if (allCollection && r.collectionId !== allCollection.id) continue;
    const idStr = String(r.articleId);
    if (seen.has(idStr)) continue;
    seen.add(idStr);
    entries.push(rowToEntry(r));
  }
  // Pass 2: orphans only in user-named collections
  for (const r of savedCardRows) {
    const idStr = String(r.articleId);
    if (seen.has(idStr)) continue;
    seen.add(idStr);
    entries.push(rowToEntry(r));
  }

  return NextResponse.json(
    syncStateResponseSchema.parse({
      entries,
      collections: userNamedCollections.map((c) => ({
        id: c.id,
        name: c.name,
        createdAt: c.createdAt?.toISOString() ?? new Date().toISOString(),
        articleIds: itemsByCollection.get(c.id) ?? [],
      })),
      streak: {
        count: userRow?.streakCount ?? 0,
        lastDay: userRow?.streakLastDay ?? '',
      },
      topicPrefs: userRow?.topicPrefs ?? [],
    }),
  );
}

type CardRow = {
  articleId: number;
  wikiId: string;
  lang: string | null;
  title: string;
  subtitle: string | null;
  hook: string | null;
  wikipediaUrl: string | null;
  sourceUrl: string | null;
  width: number | null;
  height: number | null;
  dominantColor: string | null;
  categories: string[];
  addedAt: Date | null;
};

function rowToEntry(r: CardRow) {
  return {
    card: {
      articleId: String(r.articleId),
      wikiId: r.wikiId,
      lang: r.lang ?? 'en',
      title: r.title,
      subtitle: r.subtitle,
      hook: r.hook ?? '',
      image:
        r.sourceUrl && r.width && r.height
          ? {
              url: r.sourceUrl,
              width: r.width,
              height: r.height,
              dominantColor: r.dominantColor ?? null,
            }
          : null,
      categories: r.categories,
      wikipediaUrl: r.wikipediaUrl ?? `https://en.wikipedia.org/?curid=${r.wikiId}`,
      attribution: 'CC BY-SA 4.0 — Wikipedia',
      fetchedAt: new Date().toISOString(),
    },
    savedAt: r.addedAt?.toISOString() ?? new Date().toISOString(),
  };
}
