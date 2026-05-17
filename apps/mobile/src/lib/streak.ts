import { useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';

// "Interaction-gated streak" per 02-product-spec.md §3.x — we count
// distinct calendar days the user opened the app. No guilt copy, no
// auto-decrement; missing a day just resets. Stored locally; persists
// across launches but not across uninstalls.

const STORAGE_KEY = 'knowra.streak';
const MILESTONE_KEY = 'knowra.streak_milestone_celebrated';
export const MILESTONES = [3, 7, 30, 100] as const;
export type Milestone = (typeof MILESTONES)[number];

type Streak = {
  count: number;
  lastDay: string; // ISO date YYYY-MM-DD (local calendar day)
};

// Local calendar day, not UTC — a 11pm visit and a 1am visit should be
// the SAME day to most users' intuition. Use the device's local zone.
function localDay(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function dayDiff(later: string, earlier: string): number {
  const a = Date.parse(`${later}T12:00:00`);
  const b = Date.parse(`${earlier}T12:00:00`);
  return Math.round((a - b) / 86_400_000);
}

let cache: Streak | null = null;
let loadPromise: Promise<Streak> | null = null;
const subscribers = new Set<(s: Streak) => void>();

async function loadFromDisk(): Promise<Streak> {
  const raw = await SecureStore.getItemAsync(STORAGE_KEY);
  if (!raw) return { count: 0, lastDay: '' };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === 'object' &&
      'count' in parsed &&
      'lastDay' in parsed
    ) {
      const p = parsed as { count: unknown; lastDay: unknown };
      if (typeof p.count === 'number' && typeof p.lastDay === 'string') {
        return { count: p.count, lastDay: p.lastDay };
      }
    }
  } catch {
    // fallthrough — corrupt state resets cleanly
  }
  return { count: 0, lastDay: '' };
}

async function ensureLoaded(): Promise<Streak> {
  if (cache) return cache;
  loadPromise ??= loadFromDisk();
  cache = await loadPromise;
  return cache;
}

function commit(next: Streak): void {
  cache = next;
  for (const sub of subscribers) sub(next);
  void SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
}

/**
 * Record an app-open event. Called once per app launch from the root
 * layout. Returns the post-update streak. Rules:
 *   - same day → no change
 *   - exactly one day later → count + 1
 *   - more than one day later → reset to 1
 */
export async function recordAppOpen(): Promise<Streak> {
  const current = await ensureLoaded();
  const today = localDay();
  if (current.lastDay === today) return current;
  let nextCount: number;
  if (current.lastDay === '') {
    nextCount = 1;
  } else {
    const diff = dayDiff(today, current.lastDay);
    nextCount = diff === 1 ? current.count + 1 : 1;
  }
  const next: Streak = { count: nextCount, lastDay: today };
  commit(next);
  return next;
}

export function useStreak(): Streak {
  const [streak, setStreak] = useState<Streak>({ count: 0, lastDay: '' });
  useEffect(() => {
    let mounted = true;
    void ensureLoaded().then((s) => {
      if (mounted) setStreak(s);
    });
    const sub = (s: Streak) => setStreak(s);
    subscribers.add(sub);
    return () => {
      mounted = false;
      subscribers.delete(sub);
    };
  }, []);
  return streak;
}

/**
 * Return any newly-unlocked milestone (3 / 7 / 30 / 100). Pops at most
 * once per milestone for the lifetime of this device — we persist the
 * last-celebrated value so backgrounding and reopening doesn't retrigger.
 */
export async function consumeNextMilestone(streak: Streak): Promise<Milestone | null> {
  const lastCelebratedRaw = await SecureStore.getItemAsync(MILESTONE_KEY);
  const lastCelebrated = lastCelebratedRaw ? Number(lastCelebratedRaw) : 0;
  const due = MILESTONES.find((m) => streak.count >= m && lastCelebrated < m);
  if (!due) return null;
  await SecureStore.setItemAsync(MILESTONE_KEY, String(due)).catch(() => {});
  return due;
}
