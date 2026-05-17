import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { randomCardResponseSchema, type Card } from '@knowra/shared';
import { articles, getDb, images } from '@knowra/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Test/debug endpoint — fetch a known article from the local DB by its
// Wikipedia page id. Useful for confirming LLM hook regeneration without
// hunting through random articles. Not for production traffic.
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ wikiId: string }> },
) {
  const { wikiId } = await ctx.params;
  const db = getDb();

  const [row] = await db
    .select({
      article: articles,
      image: images,
    })
    .from(articles)
    .leftJoin(images, eq(articles.heroImageId, images.id))
    .where(and(eq(articles.wikiId, wikiId), eq(articles.status, 'ready')))
    .limit(1);

  if (!row) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: `No article cached with wiki_id ${wikiId}` } },
      { status: 404 },
    );
  }

  const a = row.article;
  const img = row.image;
  const wikipediaUrl = `https://${a.lang ?? 'en'}.wikipedia.org/?curid=${a.wikiId}`;

  const card: Card & { hookSource: string | null } = {
    articleId: String(a.id),
    wikiId: a.wikiId,
    lang: a.lang ?? 'en',
    title: a.title,
    subtitle: a.subtitle,
    hook: a.hook ?? '',
    image:
      img && img.width && img.height
        ? {
            url: img.sourceUrl,
            width: img.width,
            height: img.height,
            dominantColor: img.dominantColor,
          }
        : null,
    wikipediaUrl,
    attribution: 'Wikipedia, CC BY-SA 4.0',
    fetchedAt: new Date().toISOString(),
    // Extra: surface the hook provenance for debugging.
    hookSource: a.hookSource,
  };

  // Validate the Card subset against the schema; the extra hookSource
  // field is allowed-through since z.object() by default strips unknowns,
  // so we serialize manually.
  randomCardResponseSchema.parse({ card: { ...card, hookSource: undefined } });
  return NextResponse.json({ card });
}
