import { useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import {
  generateQuizResponseSchema,
  type Card,
  type QuizQuestion,
} from '@knowra/shared';

// SecureStore-backed spaced-repetition store for quizzes generated from
// saved articles. Each saved article gets one MCQ at save-time; the
// MCQ is then surfaced at intervals matching the SRS schedule below.
// Storage shape is intentionally flat — we keep one record per article
// rather than one per scheduled showing, because the recurrence is
// deterministic from `createdAt + intervalIdx`.

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
const STORAGE_KEY = 'knowra.quizzes_v1';
const DAILY_LOG_KEY = 'knowra.quizzes_daily_log_v1';

// Forgetting-curve intervals in days. Each entry is the gap from the
// previous showing (the first showing is at +1d from save). After the
// last interval the quiz retires from circulation.
const INTERVAL_DAYS = [1, 3, 7, 21] as const;
const DAILY_QUIZ_CAP = 3;
const SHOW_WINDOW_MS = 24 * 60 * 60 * 1000; // a due quiz remains "due" for 24h

export type QuizAttempt = {
  // 0..3 — which option the user picked. null if shown but not answered.
  pickedIndex: 0 | 1 | 2 | 3 | null;
  // The interval index this attempt was associated with.
  intervalIdx: number;
  // Wall-clock ISO when the user attempted (or null if not yet).
  answeredAt: string | null;
};

export type QuizRecord = {
  articleId: string;
  wikiId: string;
  card: Card;
  quiz: QuizQuestion;
  createdAt: string; // ISO of when the quiz was generated
  attempts: QuizAttempt[];
};

type Store = { records: QuizRecord[] };

let cache: Store | null = null;
let loadPromise: Promise<Store> | null = null;
const subscribers = new Set<(s: Store) => void>();

async function loadFromDisk(): Promise<Store> {
  const raw = await SecureStore.getItemAsync(STORAGE_KEY);
  if (!raw) return { records: [] };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && 'records' in parsed) {
      const p = parsed as { records: unknown };
      if (Array.isArray(p.records)) return { records: p.records as QuizRecord[] };
    }
  } catch {
    /* corrupt — reset */
  }
  return { records: [] };
}

async function ensureLoaded(): Promise<Store> {
  if (cache) return cache;
  loadPromise ??= loadFromDisk();
  cache = await loadPromise;
  return cache;
}

function commit(next: Store): void {
  cache = next;
  for (const sub of subscribers) sub(next);
  void SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
}

// ---------- Generation ----------

/**
 * Generate (or refresh) the quiz attached to a saved article. Called
 * from `toggleSaved` when the toggle is a save (not an unsave). Idempotent:
 * if a quiz already exists for the article, this no-ops.
 *
 * Failure modes are silent — quizzes are an enhancement, never a gate.
 */
export async function ensureQuizForArticle(card: Card): Promise<void> {
  const store = await ensureLoaded();
  if (store.records.some((r) => r.articleId === card.articleId)) return;

  try {
    const res = await fetch(`${API_URL}/api/quizzes/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wikiId: card.wikiId }),
    });
    if (!res.ok) return;
    const json: unknown = await res.json();
    const parsed = generateQuizResponseSchema.safeParse(json);
    if (!parsed.success) return;

    // Re-check the store inside the await window — a parallel save of
    // the same article could have already inserted.
    const fresh = await ensureLoaded();
    if (fresh.records.some((r) => r.articleId === card.articleId)) return;

    const record: QuizRecord = {
      articleId: card.articleId,
      wikiId: card.wikiId,
      card,
      quiz: parsed.data.quiz,
      createdAt: new Date().toISOString(),
      attempts: [],
    };
    commit({ records: [...fresh.records, record] });
  } catch {
    /* network/generation failure — silent */
  }
}

/**
 * Drop the quiz for an article — used when the user unsaves. The SRS
 * schedule for an article we no longer care about should not keep
 * polluting the feed.
 */
export async function removeQuizForArticle(articleId: string): Promise<void> {
  const store = await ensureLoaded();
  const next = store.records.filter((r) => r.articleId !== articleId);
  if (next.length === store.records.length) return;
  commit({ records: next });
}

// ---------- Scheduling ----------

function localDay(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** How many quiz attempts have been logged today (cap enforcement). */
async function getTodayCount(): Promise<number> {
  const raw = await SecureStore.getItemAsync(DAILY_LOG_KEY);
  if (!raw) return 0;
  try {
    const parsed = JSON.parse(raw) as { day?: string; count?: number };
    if (parsed.day === localDay() && typeof parsed.count === 'number') {
      return parsed.count;
    }
  } catch {
    /* corrupt — reset */
  }
  return 0;
}

async function bumpTodayCount(): Promise<void> {
  const today = localDay();
  let current = 0;
  const raw = await SecureStore.getItemAsync(DAILY_LOG_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { day?: string; count?: number };
      if (parsed.day === today && typeof parsed.count === 'number') {
        current = parsed.count;
      }
    } catch {
      /* fall through */
    }
  }
  await SecureStore.setItemAsync(
    DAILY_LOG_KEY,
    JSON.stringify({ day: today, count: current + 1 }),
  ).catch(() => {});
}

/**
 * Return the next interval index a record is due for, or null if it's
 * retired (all intervals consumed) or not due yet.
 */
function nextDueIntervalIdx(record: QuizRecord, now: Date): number | null {
  const createdMs = Date.parse(record.createdAt);
  if (Number.isNaN(createdMs)) return null;
  const cumulativeDays = (intervalIdx: number) => {
    let sum = 0;
    for (let i = 0; i <= intervalIdx; i++) sum += INTERVAL_DAYS[i] ?? 0;
    return sum;
  };

  for (let i = 0; i < INTERVAL_DAYS.length; i++) {
    const alreadyDone = record.attempts.some((a) => a.intervalIdx === i && a.answeredAt);
    if (alreadyDone) continue;
    const dueAt = createdMs + cumulativeDays(i) * 24 * 60 * 60 * 1000;
    const elapsed = now.getTime() - dueAt;
    if (elapsed >= 0 && elapsed < SHOW_WINDOW_MS) return i;
    if (elapsed >= SHOW_WINDOW_MS) {
      // Missed — log a no-answer attempt so we move on. Otherwise a
      // missed Monday quiz lingers forever and clogs the queue.
      record.attempts.push({
        pickedIndex: null,
        intervalIdx: i,
        answeredAt: new Date(dueAt + SHOW_WINDOW_MS).toISOString(),
      });
      continue;
    }
    // Not yet due → stop scanning; later intervals are even further out.
    break;
  }
  return null;
}

/**
 * Return up to `cap` quiz records that are due now, capped at the
 * daily limit. The returned records are still owned by the local store
 * — calling code calls `recordAnswer` after the user picks an option.
 */
export async function dueQuizzes(maxToInject = DAILY_QUIZ_CAP): Promise<QuizRecord[]> {
  const store = await ensureLoaded();
  const today = await getTodayCount();
  const remaining = Math.max(0, DAILY_QUIZ_CAP - today);
  if (remaining === 0) return [];

  const now = new Date();
  const out: QuizRecord[] = [];
  let mutated = false;
  for (const r of store.records) {
    if (out.length >= Math.min(remaining, maxToInject)) break;
    const before = r.attempts.length;
    const idx = nextDueIntervalIdx(r, now);
    if (r.attempts.length !== before) mutated = true;
    if (idx !== null) out.push(r);
  }
  if (mutated) commit({ records: [...store.records] });
  return out;
}

/**
 * Record the user's answer. `pickedIndex` is the 0-3 they tapped, or
 * null if they swiped past without answering. Bumps the daily count
 * only when the user actually answered (skipping doesn't burn quota).
 */
export async function recordAnswer(
  articleId: string,
  pickedIndex: 0 | 1 | 2 | 3 | null,
): Promise<void> {
  const store = await ensureLoaded();
  const idx = store.records.findIndex((r) => r.articleId === articleId);
  if (idx < 0) return;
  const record = store.records[idx]!;
  const now = new Date();
  const intervalIdx = nextDueIntervalIdx(record, now);
  // nextDueIntervalIdx may have mutated record.attempts to log misses;
  // we still take the resulting record snapshot.
  if (intervalIdx === null) return;
  record.attempts.push({
    pickedIndex,
    intervalIdx,
    answeredAt: new Date().toISOString(),
  });
  commit({ records: [...store.records] });
  if (pickedIndex !== null) await bumpTodayCount();
}

// ---------- React hooks ----------

export function useDueQuizCount(): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let mounted = true;
    void (async () => {
      const due = await dueQuizzes();
      if (mounted) setCount(due.length);
    })();
    const sub = () => {
      void (async () => {
        const due = await dueQuizzes();
        if (mounted) setCount(due.length);
      })();
    };
    subscribers.add(sub);
    return () => {
      mounted = false;
      subscribers.delete(sub);
    };
  }, []);
  return count;
}
