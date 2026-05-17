import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image as ExpoImage } from 'expo-image';
import { cardBatchResponseSchema, type Card } from '@knowra/shared';
import { getDeviceId } from '@/lib/device';
import { getTopicPrefs } from '@/lib/topicPrefs';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

const INITIAL_BATCH = 3; // first paint priority — smaller is faster
const REFILL_BATCH = 5;
const REFILL_TRIGGER = 2; // refill when ≤ this many cards remain ahead of current

export type FeedType = 'foryou' | 'trending' | 'random' | 'today';

type FeedState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready' };

export type CardFeed = {
  state: FeedState;
  current: Card | undefined;
  next: Card | undefined;
  prev: Card | undefined;
  canGoBack: boolean;
  advance: () => void;
  goBack: () => void;
  retry: () => void;
  insertAfterCurrent: (cards: Card[]) => number;
};

function endpointFor(feedType: FeedType, count: number): string {
  switch (feedType) {
    case 'today':
      return `${API_URL}/api/cards/today?count=${count}`;
    case 'foryou':
      return `${API_URL}/api/cards/foryou?count=${count}`;
    case 'trending':
      return `${API_URL}/api/cards/trending?count=${count}`;
    case 'random':
      return `${API_URL}/api/cards/batch?count=${count}`;
  }
}

async function fetchBatch(feedType: FeedType, count: number): Promise<Card[]> {
  // Always send the device id + topic prefs — the backend personalizes
  // For You with them and ignores them for the other feeds. Keeping
  // them on every request makes the headers optional from the server's
  // point of view.
  const [deviceId, topics] = await Promise.all([getDeviceId(), getTopicPrefs()]);
  const headers: Record<string, string> = { 'X-Knowra-Device-Id': deviceId };
  if (topics.length > 0) {
    // Lowercased, comma-joined. Matches the Wikipedia article titles we
    // use as seeds on the backend (e.g. "science", "history").
    headers['X-Knowra-Topics'] = topics.map((t) => t.toLowerCase()).join(',');
  }
  const res = await fetch(endpointFor(feedType, count), { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json: unknown = await res.json();
  const parsed = cardBatchResponseSchema.parse(json);
  return parsed.cards;
}

export function useCardFeed(feedType: FeedType = 'random'): CardFeed {
  const [cards, setCards] = useState<Card[]>([]);
  const [index, setIndex] = useState(0);
  const [state, setState] = useState<FeedState>({ kind: 'loading' });
  const refilling = useRef(false);
  // Reset buffer + index when switching feeds. Keeping a separate buffer
  // per feed would let users keep their place when switching back, but
  // that's a Slice 2c+ polish — for now, a switch is a fresh start.
  const activeFeed = useRef<FeedType>(feedType);

  const initialLoad = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      const batch = await fetchBatch(feedType, INITIAL_BATCH);
      setCards(batch);
      setIndex(0);
      setState({ kind: 'ready' });
    } catch (err) {
      setState({
        kind: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }, [feedType]);

  useEffect(() => {
    activeFeed.current = feedType;
    void initialLoad();
  }, [feedType, initialLoad]);

  // Prefetch the next card's hero image so the swipe-up reveal is
  // instant. expo-image dedupes by URL, so calling this on every render
  // when `index` changes is safe and cheap.
  useEffect(() => {
    const next = cards[index + 1];
    if (next?.image?.url) {
      void ExpoImage.prefetch(next.image.url);
    }
  }, [cards, index]);

  // Refill when running low on lookahead.
  useEffect(() => {
    if (state.kind !== 'ready') return;
    const remainingAhead = cards.length - 1 - index;
    if (remainingAhead > REFILL_TRIGGER) return;
    if (refilling.current) return;
    refilling.current = true;
    const feedAtStart = activeFeed.current;
    void (async () => {
      try {
        const batch = await fetchBatch(feedAtStart, REFILL_BATCH);
        // Discard if the user switched feeds mid-flight.
        if (activeFeed.current !== feedAtStart) return;
        setCards((prev) => [...prev, ...batch]);
      } catch {
        // Quiet failure — user still has the current buffer. Next swipe
        // will trigger another refill attempt.
      } finally {
        refilling.current = false;
      }
    })();
  }, [cards.length, index, state.kind]);

  const advance = useCallback(() => {
    setIndex((i) => Math.min(i + 1, Number.MAX_SAFE_INTEGER));
  }, []);

  const goBack = useCallback(() => {
    setIndex((i) => Math.max(0, i - 1));
  }, []);

  /**
   * Splice cards into the buffer immediately after the current card.
   * Dedupes against everything already in the buffer (by articleId) so
   * we don't queue the same article twice. Returns the number of new
   * cards actually inserted — callers can show a toast like
   * "+3 related" with the truthful count.
   */
  const insertAfterCurrent = useCallback(
    (newCards: Card[]): number => {
      if (newCards.length === 0) return 0;
      let inserted = 0;
      setCards((prev) => {
        const existing = new Set(prev.map((c) => c.articleId));
        const fresh = newCards.filter((c) => !existing.has(c.articleId));
        inserted = fresh.length;
        if (fresh.length === 0) return prev;
        return [...prev.slice(0, index + 1), ...fresh, ...prev.slice(index + 1)];
      });
      return inserted;
    },
    [index],
  );

  return useMemo(
    () => ({
      state,
      current: cards[index],
      next: cards[index + 1],
      prev: index > 0 ? cards[index - 1] : undefined,
      canGoBack: index > 0,
      advance,
      goBack,
      retry: initialLoad,
      insertAfterCurrent,
    }),
    [state, cards, index, advance, goBack, initialLoad, insertAfterCurrent],
  );
}
