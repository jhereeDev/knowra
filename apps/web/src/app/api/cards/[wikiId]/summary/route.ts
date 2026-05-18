import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { articleSummaryResponseSchema } from '@knowra/shared';
import { articles, getDb } from '@knowra/db';
import { fetchArticleExtract } from '@/lib/wikipedia';
import { generateSummary } from '@/lib/summary';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/cards/[wikiId]/summary
//
// Returns the AI-generated 300-word "if you only read one thing" summary
// for the article. Lazy and cached: the first hit on a given article calls
// the LLM (~2-3s); every subsequent hit is a single DB read.
//
// Cache path (hot):  DB row has `summary` populated → return immediately.
// Generate path:     fetch full extract from Wikipedia → call generateSummary
//                    → persist → return.
// Fallback path:     LLM error / no_summary → return the Wikipedia extract
//                    we already have on the row, with source='extract' so
//                    the client knows it's not the AI version.
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ wikiId: string }> },
) {
  const { wikiId } = await ctx.params;
  const db = getDb();

  const [row] = await db
    .select({
      id: articles.id,
      wikiId: articles.wikiId,
      lang: articles.lang,
      title: articles.title,
      hook: articles.hook,
      summary: articles.summary,
      updatedAt: articles.updatedAt,
    })
    .from(articles)
    .where(and(eq(articles.wikiId, wikiId), eq(articles.status, 'ready')))
    .limit(1);

  if (!row) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: `No article cached with wiki_id ${wikiId}` } },
      { status: 404 },
    );
  }

  // Hot path — already generated.
  if (row.summary && row.summary.trim()) {
    return NextResponse.json(
      articleSummaryResponseSchema.parse({
        wikiId: row.wikiId,
        title: row.title,
        summary: row.summary,
        source: 'llm',
        attribution: 'AI summary of Wikipedia, CC BY-SA 4.0',
        generatedAt: row.updatedAt?.toISOString() ?? null,
      }),
    );
  }

  // Generation path. Pull the full extract from Wikipedia, summarize, persist.
  let fullExtract = '';
  try {
    fullExtract = await fetchArticleExtract(row.wikiId, row.lang ?? 'en');
  } catch {
    // Network/Wikipedia failure — fall through to the extract fallback below
    // using whatever we have cached on the row.
  }

  // Prefer the freshly-fetched full extract; if that failed, fall back to
  // the truncated extract on the row (originally cached as the hook).
  const sourceText = fullExtract || (row.hook ?? '');

  const result = sourceText
    ? await generateSummary(row.title, sourceText)
    : ({ kind: 'no_summary' } as const);

  if (result.kind === 'ok') {
    const now = new Date();
    await db
      .update(articles)
      .set({ summary: result.summary, updatedAt: now })
      .where(eq(articles.id, row.id));
    return NextResponse.json(
      articleSummaryResponseSchema.parse({
        wikiId: row.wikiId,
        title: row.title,
        summary: result.summary,
        source: 'llm',
        attribution: 'AI summary of Wikipedia, CC BY-SA 4.0',
        generatedAt: now.toISOString(),
      }),
    );
  }

  // Fallback — the reader should never be empty. Serve whatever we have
  // as plain Wikipedia extract. Deliberately NOT persisted: a future
  // request will retry the LLM (so a transient error doesn't permanently
  // downgrade the article to extract-only).
  return NextResponse.json(
    articleSummaryResponseSchema.parse({
      wikiId: row.wikiId,
      title: row.title,
      summary: sourceText || row.title,
      source: 'extract',
      attribution: 'Wikipedia, CC BY-SA 4.0',
      generatedAt: null,
    }),
  );
}
