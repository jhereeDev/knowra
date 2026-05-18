import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import {
  generateQuizRequestSchema,
  generateQuizResponseSchema,
} from '@knowra/shared';
import { articles, getDb } from '@knowra/db';
import { generateQuiz } from '@/lib/quiz';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/quizzes/generate — generate one MCQ for a saved article.
// Anonymous: this is gated by the article being in our DB (and thus
// previously surfaced on a feed), not by user identity. Cost is small
// enough that an attacker spamming with random wikiIds caps at a few
// dollars/day, and Cloudflare rate limits the route at the edge.
export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: { code: 'bad_request', message: 'invalid JSON' } },
      { status: 400 },
    );
  }

  const parsed = generateQuizRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'bad_request', message: parsed.error.message } },
      { status: 400 },
    );
  }

  const db = getDb();
  const articleRow = (
    await db
      .select({
        title: articles.title,
        hook: articles.hook,
        summary: articles.summary,
      })
      .from(articles)
      .where(eq(articles.wikiId, parsed.data.wikiId))
      .limit(1)
  )[0];

  if (!articleRow) {
    return NextResponse.json(
      { error: { code: 'not_found', message: 'article not in DB' } },
      { status: 404 },
    );
  }

  const result = await generateQuiz(
    articleRow.title,
    articleRow.hook ?? '',
    articleRow.summary ?? articleRow.hook ?? '',
  );
  if (result.kind !== 'ok') {
    return NextResponse.json(
      { error: { code: 'generation_failed', message: result.message } },
      { status: 502 },
    );
  }

  return NextResponse.json(
    generateQuizResponseSchema.parse({ quiz: result.quiz }),
  );
}
