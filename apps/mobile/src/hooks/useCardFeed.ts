import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image as ExpoImage } from 'expo-image';
import { cardBatchResponseSchema, type Card } from '@knowra/shared';
import { getDeviceId } from '@/lib/device';
import { getTopicPrefs } from '@/lib/topicPrefs';
import { readFeedCache, writeFeedCache } from '@/lib/feedCache';
import { dueQuizzes, type QuizRecord } from '@/lib/quizzes';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

const INITIAL_BATCH = 3; // first paint priority — smaller is faster
const REFILL_BATCH = 5;
const REFILL_TRIGGER = 2; // refill when ≤ this many cards remain ahead of current

export type FeedType = 'foryou' | 'trending' | 'random' | 'today';

type FeedState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready' };

// Heterogeneous feed item — the pager moves through these one at a time.
// Card items render as the normal article view; nudge items render as
// the in-stream Wikipedia donation prompt (product spec §4.11) or any
// future card-shaped interrupt (quiz cards, etc.).
export type FeedItem =
  | { kind: 'card'; key: string; card: Card }
  | { kind: 'nudge'; key: string; nudgeKind: 'donation' }
  | { kind: 'quiz'; key: string; record: QuizRecord };

export type CardFeed = {
  state: FeedState;
  current: FeedItem | undefined;
  next: FeedItem | undefined;
  prev: FeedItem | undefined;
  canGoBack: boolean;
  advance: () => void;
  goBack: () => void;
  retry: () => void;
  insertAfterCurrent: (cards: Card[]) => number;
  // Splice a single nudge item into the buffer immediately after the
  // current position. Returns true if a nudge was inserted, false if
  // there's already a nudge ahead within the next few slots (avoids
  // back-to-back nudges if the caller double-fires).
  injectNudgeAfterCurrent: (nudgeKind: 'donation') => boolean;
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

// Wrap a fetched card batch into FeedItems. Pure helper — no state.
function toCardItems(cards: Card[]): FeedItem[] {
  return cards.map((card) => ({ kind: 'card' as const, key: card.articleId, card }));
}

// Interleave quiz items into a card list at every 3rd slot starting at
// position 1. Result: [card, quiz?, card, card, quiz?, card, card, quiz?, …].
// If `quizzes` is empty, returns the cards unchanged. If it has more
// quizzes than slots, the overflow is dropped — they remain in the SRS
// store and will be picked up next session.
function interleaveQuizzes(cards: FeedItem[], quizzes: QuizRecord[]): FeedItem[] {
  if (quizzes.length === 0) return cards;
  const out: FeedItem[] = [];
  let qi = 0;
  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    if (card) out.push(card);
    // Inject after positions 0, 3, 6, …
    if (i % 3 === 0 && qi < quizzes.length) {
      const q = quizzes[qi]!;
      out.push({ kind: 'quiz', key: `quiz:${q.articleId}:${q.attempts.length}`, record: q });
      qi += 1;
    }
  }
  return out;
}

// Monotonic nudge id so back-to-back injections never collide as React keys.
let _nudgeSeq = 0;
function nextNudgeKey(kind: 'donation'): string {
  _nudgeSeq += 1;
  return `nudge:${kind}:${_nudgeSeq}`;
}

export function useCardFeed(feedType: FeedType = 'random'): CardFeed {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [index, setIndex] = useState(0);
  const [state, setState] = useState<FeedState>({ kind: 'loading' });
  const refilling = useRef(false);
  // Reset buffer + index when switching feeds. Keeping a separate buffer
  // per feed would let users keep their place when switching back, but
  // that's a Slice 2c+ polish — for now, a switch is a fresh start.
  const activeFeed = useRef<FeedType>(feedType);

  const initialLoad = useCallback(async () => {
    // Local-first: try the cache before the network. On hit, we paint
    // instantly and the network fetch becomes a background refresh
    // instead of a blocking dependency. On miss, fall through to the
    // loading skeleton like before.
    const cached = await readFeedCache(feedType);
    if (cached && cached.length > 0) {
      setItems(toCardItems(cached));
      setIndex(0);
      setState({ kind: 'ready' });
    } else {
      setState({ kind: 'loading' });
    }

    try {
      const [batch, dueQ] = await Promise.all([
        fetchBatch(feedType, INITIAL_BATCH),
        dueQuizzes(),
      ]);
      // The user may have switched feeds while we were waiting on the
      // network — bail without touching the visible state.
      if (activeFeed.current !== feedType) return;

      if (cached && cached.length > 0) {
        // Cache hit: keep what the user is reading, append fresh cards
        // dedup'd against the cache. Refill logic will keep the buffer
        // topped up from there.
        setItems((prev) => {
          const seen = new Set(
            prev
              .filter(
                (it): it is Extract<FeedItem, { kind: 'card' }> => it.kind === 'card',
              )
              .map((it) => it.card.articleId),
          );
          const fresh = batch.filter((c) => !seen.has(c.articleId));
          return fresh.length > 0 ? [...prev, ...toCardItems(fresh)] : prev;
        });
      } else {
        // Cache miss path: this is the first-ever load (or post-clear).
        // Replace the empty buffer with the fresh batch + any due quizzes
        // interleaved at every-3rd position. Quizzes only inject on cold
        // boot — the refill path stays pure-cards, so users don't get a
        // surprise quiz mid-doom-scroll.
        const interleaved = interleaveQuizzes(toCardItems(batch), dueQ);
        setItems(interleaved);
        setIndex(0);
        setState({ kind: 'ready' });
      }

      // Always update the cache snapshot with whatever the server just
      // returned, so the *next* cold start gets the most recent picks.
      // Fire-and-forget; cache write failure is silent.
      void writeFeedCache(feedType, batch);
    } catch (err) {
      // If we had a cache hit, swallow the network failure — the user
      // still sees content and a future refill will retry. Only when
      // there's no cache do we show the error screen.
      if (!cached || cached.length === 0) {
        setState({
          kind: 'error',
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }, [feedType]);

  useEffect(() => {
    activeFeed.current = feedType;
    void initialLoad();
  }, [feedType, initialLoad]);

  // Prefetch the next card's hero image so the swipe-up reveal is
  // instant. expo-image dedupes by URL, so calling this on every render
  // when `index` changes is safe and cheap. Nudge items have no image,
  // so we skip them.
  useEffect(() => {
    const next = items[index + 1];
    if (next?.kind === 'card' && next.card.image?.url) {
      void ExpoImage.prefetch(next.card.image.url);
    }
  }, [items, index]);

  // Refill when running low on lookahead. Only counts card items toward
  // the threshold so a nudge ahead of the current position doesn't
  // suppress the refill.
  useEffect(() => {
    if (state.kind !== 'ready') return;
    const cardsAhead = items
      .slice(index + 1)
      .filter((it) => it.kind === 'card').length;
    if (cardsAhead > REFILL_TRIGGER) return;
    if (refilling.current) return;
    refilling.current = true;
    const feedAtStart = activeFeed.current;
    void (async () => {
      try {
        const batch = await fetchBatch(feedAtStart, REFILL_BATCH);
        // Discard if the user switched feeds mid-flight.
        if (activeFeed.current !== feedAtStart) return;
        // Dedup by articleId — the server may return a card that's
        // already in our buffer (trending in particular, since the
        // most-read pool repeats). Without this the user sees the same
        // article twice on consecutive swipes.
        setItems((prev) => {
          const seen = new Set(
            prev
              .filter((it): it is Extract<FeedItem, { kind: 'card' }> => it.kind === 'card')
              .map((it) => it.card.articleId),
          );
          const fresh = batch.filter((c) => !seen.has(c.articleId));
          return fresh.length > 0 ? [...prev, ...toCardItems(fresh)] : prev;
        });
      } catch {
        // Quiet failure — user still has the current buffer. Next swipe
        // will trigger another refill attempt.
      } finally {
        refilling.current = false;
      }
    })();
  }, [items, index, state.kind]);

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
      setItems((prev) => {
        const existing = new Set(
          prev
            .filter((it): it is Extract<FeedItem, { kind: 'card' }> => it.kind === 'card')
            .map((it) => it.card.articleId),
        );
        const fresh = newCards.filter((c) => !existing.has(c.articleId));
        inserted = fresh.length;
        if (fresh.length === 0) return prev;
        return [
          ...prev.slice(0, index + 1),
          ...toCardItems(fresh),
          ...prev.slice(index + 1),
        ];
      });
      return inserted;
    },
    [index],
  );

  /**
   * Insert one nudge slot immediately after the current position.
   * Guards against back-to-back nudges: if any of the next 3 slots is
   * already a nudge, we no-op and return false.
   */
  const injectNudgeAfterCurrent = useCallback(
    (nudgeKind: 'donation'): boolean => {
      let injected = false;
      setItems((prev) => {
        const lookahead = prev.slice(index + 1, index + 4);
        if (lookahead.some((it) => it.kind === 'nudge')) return prev;
        const nudge: FeedItem = {
          kind: 'nudge',
          key: nextNudgeKey(nudgeKind),
          nudgeKind,
        };
        injected = true;
        return [...prev.slice(0, index + 1), nudge, ...prev.slice(index + 1)];
      });
      return injected;
    },
    [index],
  );

  return useMemo(
    () => ({
      state,
      current: items[index],
      next: items[index + 1],
      prev: index > 0 ? items[index - 1] : undefined,
      canGoBack: index > 0,
      advance,
      goBack,
      retry: initialLoad,
      insertAfterCurrent,
      injectNudgeAfterCurrent,
    }),
    [
      state,
      items,
      index,
      advance,
      goBack,
      initialLoad,
      insertAfterCurrent,
      injectNudgeAfterCurrent,
    ],
  );
}
