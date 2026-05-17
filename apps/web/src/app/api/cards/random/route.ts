import { NextResponse } from 'next/server';
import { randomCardResponseSchema } from '@knowra/shared';
import { fetchRandomSummary, summaryToCard, WikipediaError } from '@/lib/wikipedia';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_ATTEMPTS = 3;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const lang = url.searchParams.get('lang') ?? 'en';

  // Wikipedia's random endpoint occasionally returns disambiguation pages
  // or stubs with no extract. Retry a few times to surface a usable card.
  let lastError: unknown = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const summary = await fetchRandomSummary(lang);
      if (summary.type === 'disambiguation' || !summary.extract?.trim()) {
        continue;
      }
      const card = await summaryToCard(summary);
      const body = randomCardResponseSchema.parse({ card });
      return NextResponse.json(body);
    } catch (err) {
      lastError = err;
      if (err instanceof WikipediaError && err.status && err.status >= 400 && err.status < 500) {
        break;
      }
    }
  }

  const message =
    lastError instanceof Error ? lastError.message : 'Unknown error fetching random card';
  return NextResponse.json(
    { error: { code: 'WIKIPEDIA_FETCH_FAILED', message } },
    { status: 502 },
  );
}
