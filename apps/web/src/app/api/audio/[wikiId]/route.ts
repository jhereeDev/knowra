import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { generateAudioResponseSchema } from '@knowra/shared';
import { articles, getDb } from '@knowra/db';
import { estimateDurationMs, generateAudio } from '@/lib/tts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/audio/[wikiId]
//
// Generate (or return cached) MP3 narration of the article. Anonymous
// access — gated by the article being known to our DB. Cost is small
// per generation (~$0.0075 on OpenAI tts-1) and disk-cached forever,
// so a spammy attacker bottoms out after they've narrated every
// article we've ever surfaced.
export async function POST(
  _req: Request,
  ctx: { params: Promise<{ wikiId: string }> },
): Promise<Response> {
  const { wikiId } = await ctx.params;
  if (!wikiId) {
    return NextResponse.json(
      { error: { code: 'bad_request', message: 'wikiId required' } },
      { status: 400 },
    );
  }

  const db = getDb();
  const [row] = await db
    .select({
      title: articles.title,
      hook: articles.hook,
      summary: articles.summary,
    })
    .from(articles)
    .where(eq(articles.wikiId, wikiId))
    .limit(1);

  if (!row) {
    return NextResponse.json(
      { error: { code: 'not_found', message: 'article not in DB' } },
      { status: 404 },
    );
  }

  // Compose the narration body. Lead with the title (so the listener
  // knows what they're hearing), then the hook, then the long summary
  // if available. Each piece is separated by a period + space so the
  // TTS voice pauses naturally.
  const parts = [row.title, row.hook ?? '', row.summary ?? ''].filter(
    (s) => s && s.trim().length > 0,
  );
  const body = parts.join('. ').replace(/\s+/g, ' ').trim();

  const result = await generateAudio(wikiId, body);
  if (result.kind !== 'ok') {
    return NextResponse.json(
      { error: { code: 'tts_failed', message: result.message } },
      { status: 502 },
    );
  }

  return NextResponse.json(
    generateAudioResponseSchema.parse({
      url: `/api/audio/file/${wikiId}`,
      durationMs: estimateDurationMs(body),
      cached: result.cached,
    }),
  );
}
