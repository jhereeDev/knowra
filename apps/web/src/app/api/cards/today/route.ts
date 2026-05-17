import { NextResponse } from 'next/server';
import { cardBatchResponseSchema, type Card } from '@knowra/shared';
import { fetchOnThisDaySummaries, summaryToCard } from '@/lib/wikipedia';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_COUNT = 5;
const MAX_COUNT = 10;

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

// Fisher-Yates shuffle. We shuffle the on-this-day pool so consecutive
// fetches don't return the same events — each refill pulls from a new
// permutation, giving the user variety across a session.
function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = copy[i];
    const other = copy[j];
    if (tmp === undefined || other === undefined) continue;
    copy[i] = other;
    copy[j] = tmp;
  }
  return copy;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const lang = url.searchParams.get('lang') ?? 'en';
  const requested = Number.parseInt(url.searchParams.get('count') ?? String(DEFAULT_COUNT), 10);
  const count = Number.isFinite(requested) ? clamp(requested, 1, MAX_COUNT) : DEFAULT_COUNT;

  let summaries;
  try {
    summaries = await fetchOnThisDaySummaries(lang);
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

  const shuffled = shuffle(summaries).slice(0, count);
  if (shuffled.length === 0) {
    return NextResponse.json(
      { error: { code: 'NO_CARDS', message: 'No usable on-this-day cards' } },
      { status: 502 },
    );
  }

  // Parallelize the per-card pipeline (DB lookup + upsert + scheduling
  // of background hook/color generation). Previously this was serial
  // and the endpoint took 3-5s for a fresh pool.
  const cards: Card[] = await Promise.all(shuffled.map((s) => summaryToCard(s)));

  const body = cardBatchResponseSchema.parse({ cards });
  return NextResponse.json(body);
}
