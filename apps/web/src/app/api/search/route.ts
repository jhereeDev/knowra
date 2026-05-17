import { NextResponse } from 'next/server';
import { searchResponseSchema } from '@knowra/shared';
import { searchWikipedia } from '@/lib/wikipedia';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Thin proxy over Wikimedia's core search API. We strip + map the
// upstream shape to a stable contract that mobile + web can rely on.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get('q') ?? '';
  const lang = url.searchParams.get('lang') ?? 'en';

  if (!q.trim()) {
    return NextResponse.json(searchResponseSchema.parse({ results: [] }));
  }

  try {
    const results = await searchWikipedia(q, lang, 10);
    return NextResponse.json(
      searchResponseSchema.parse({
        results: results.map((r) => ({
          wikiId: r.wikiId,
          title: r.title,
          description: r.description,
          thumbnailUrl: r.thumbnail?.url ?? null,
        })),
      }),
    );
  } catch (err) {
    return NextResponse.json(
      {
        error: {
          code: 'WIKIPEDIA_FETCH_FAILED',
          message: err instanceof Error ? err.message : 'Unknown',
        },
      },
      { status: 502 },
    );
  }
}
