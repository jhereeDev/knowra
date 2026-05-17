import { NextResponse } from 'next/server';
import { cardBatchResponseSchema, type Card } from '@knowra/shared';
import { fetchRandomSummary, summaryToCard } from '@/lib/wikipedia';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_COUNT = 5;
const MAX_COUNT = 10;
const PER_SLOT_ATTEMPTS = 3;

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

async function fetchOneUsableCard(lang: string): Promise<Card | null> {
  for (let attempt = 0; attempt < PER_SLOT_ATTEMPTS; attempt++) {
    try {
      const summary = await fetchRandomSummary(lang);
      if (summary.type === 'disambiguation' || !summary.extract?.trim()) continue;
      return await summaryToCard(summary);
    } catch {
      // Swallow; next attempt will retry. We don't fail the whole batch
      // because of one bad random pick.
    }
  }
  return null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const lang = url.searchParams.get('lang') ?? 'en';
  const requested = Number.parseInt(url.searchParams.get('count') ?? String(DEFAULT_COUNT), 10);
  const count = Number.isFinite(requested) ? clamp(requested, 1, MAX_COUNT) : DEFAULT_COUNT;

  const results = await Promise.all(
    Array.from({ length: count }, () => fetchOneUsableCard(lang)),
  );
  const cards = results.filter((c): c is Card => c !== null);

  if (cards.length === 0) {
    return NextResponse.json(
      { error: { code: 'WIKIPEDIA_FETCH_FAILED', message: 'No usable cards returned' } },
      { status: 502 },
    );
  }

  const body = cardBatchResponseSchema.parse({ cards });
  return NextResponse.json(body);
}
