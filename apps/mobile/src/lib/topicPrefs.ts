import { useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';

// Curated top-level topics. The product spec calls for ~50 categories
// long-term; this is a focused starter set covering the breadth of
// Wikipedia. Mirrors the kind of shelves a smart magazine would have.
export const ALL_TOPICS = [
  'History',
  'Science',
  'Technology',
  'Art',
  'Music',
  'Literature',
  'Film',
  'Sports',
  'Nature',
  'Geography',
  'Politics',
  'Philosophy',
  'Religion',
  'Food',
  'Architecture',
  'Mathematics',
  'Medicine',
  'Space',
] as const;

export type Topic = (typeof ALL_TOPICS)[number];

const STORAGE_KEY = 'knowra.topic_prefs';

let cache: Set<Topic> | null = null;
let loadPromise: Promise<Set<Topic>> | null = null;
const subscribers = new Set<(topics: Set<Topic>) => void>();

async function loadFromDisk(): Promise<Set<Topic>> {
  const raw = await SecureStore.getItemAsync(STORAGE_KEY);
  if (!raw) return new Set();
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((t): t is Topic => ALL_TOPICS.includes(t as Topic)));
  } catch {
    return new Set();
  }
}

async function ensureLoaded(): Promise<Set<Topic>> {
  if (cache) return cache;
  loadPromise ??= loadFromDisk();
  cache = await loadPromise;
  return cache;
}

function commit(next: Set<Topic>): void {
  cache = next;
  for (const sub of subscribers) sub(next);
  void SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify([...next])).catch(() => {});
}

// Read the currently-selected topics. Async because the cache may not
// be loaded yet on first call. Used by the For You fetcher to send the
// topic set as a request header alongside the device id.
export async function getTopicPrefs(): Promise<Topic[]> {
  const s = await ensureLoaded();
  return [...s];
}

export async function toggleTopic(topic: Topic): Promise<boolean> {
  const s = await ensureLoaded();
  const next = new Set(s);
  let nowSelected: boolean;
  if (next.has(topic)) {
    next.delete(topic);
    nowSelected = false;
  } else {
    next.add(topic);
    nowSelected = true;
  }
  commit(next);
  return nowSelected;
}

export function useTopicPrefs(): ReadonlySet<Topic> {
  const [topics, setTopics] = useState<ReadonlySet<Topic>>(() => new Set());
  useEffect(() => {
    let mounted = true;
    void ensureLoaded().then((s) => {
      if (mounted) setTopics(new Set(s));
    });
    const sub = (s: Set<Topic>) => setTopics(new Set(s));
    subscribers.add(sub);
    return () => {
      mounted = false;
      subscribers.delete(sub);
    };
  }, []);
  return topics;
}
