import { useEffect, useState } from 'react';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import type { Card } from '@knowra/shared';

// "All saved" entries (independent of collections — collections are
// subsets/groupings, not a separate store).
type SavedEntry = {
  card: Card;
  savedAt: string;
};

type Collection = {
  id: string;        // local UUID
  name: string;
  createdAt: string;
  articleIds: string[]; // newest first
};

type State = {
  entries: SavedEntry[];
  collections: Collection[];
};

const STORAGE_KEY = 'knowra.saved_state_v2';
const LEGACY_KEY = 'knowra.saved_articles'; // pre-collections saved list
const MAX_SAVED = 500;
const MAX_COLLECTIONS = 50;

let cache: State | null = null;
let loadPromise: Promise<State> | null = null;
const subscribers = new Set<(s: State) => void>();

async function loadFromDisk(): Promise<State> {
  // Try the new key first.
  const raw = await SecureStore.getItemAsync(STORAGE_KEY);
  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && 'entries' in parsed) {
        const p = parsed as { entries: unknown; collections?: unknown };
        return {
          entries: Array.isArray(p.entries) ? (p.entries as SavedEntry[]) : [],
          collections: Array.isArray(p.collections) ? (p.collections as Collection[]) : [],
        };
      }
    } catch {
      // fallthrough to legacy migration
    }
  }
  // Migrate from the v1 storage: the old SavedEntry[] becomes State.entries.
  const legacy = await SecureStore.getItemAsync(LEGACY_KEY);
  if (legacy) {
    try {
      const parsed: unknown = JSON.parse(legacy);
      const entries: SavedEntry[] = Array.isArray(parsed)
        ? (parsed as SavedEntry[]).filter(
            (e) => e && typeof e === 'object' && 'card' in e && 'savedAt' in e,
          )
        : [];
      const state: State = { entries, collections: [] };
      // Persist migrated shape; leave the legacy key alone for safety
      // (we'll let it age out naturally).
      await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(state));
      return state;
    } catch {
      /* fall through */
    }
  }
  return { entries: [], collections: [] };
}

async function persist(state: State): Promise<void> {
  await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(state));
}

async function ensureLoaded(): Promise<State> {
  if (cache) return cache;
  loadPromise ??= loadFromDisk();
  cache = await loadPromise;
  return cache;
}

/**
 * Drop the in-memory cache and re-read from SecureStore. Pull-to-refresh
 * uses this so the gesture actually means something — even though the
 * subscribers normally keep React in sync with writes, manually pulling
 * gives the user an escape hatch if anything ever drifts.
 */
export async function reloadFromDisk(): Promise<void> {
  cache = null;
  loadPromise = null;
  const fresh = await loadFromDisk();
  cache = fresh;
  for (const sub of subscribers) sub(fresh);
}

function commit(next: State): void {
  cache = next;
  for (const sub of subscribers) sub(next);
  void persist(next).catch(() => {
    /* persistence is best-effort; subsequent writes will retry */
  });
}

// ---------- Saved entries ----------

export async function isSaved(articleId: string): Promise<boolean> {
  const s = await ensureLoaded();
  return s.entries.some((e) => e.card.articleId === articleId);
}

export async function toggleSaved(card: Card): Promise<boolean> {
  const s = await ensureLoaded();
  const idx = s.entries.findIndex((e) => e.card.articleId === card.articleId);
  if (idx >= 0) {
    // Unsave cascades: remove from all collections too.
    const entries = s.entries.toSpliced(idx, 1);
    const collections = s.collections.map((c) => ({
      ...c,
      articleIds: c.articleIds.filter((id) => id !== card.articleId),
    }));
    commit({ entries, collections });
    return false;
  }
  const entry: SavedEntry = { card, savedAt: new Date().toISOString() };
  commit({
    entries: [entry, ...s.entries].slice(0, MAX_SAVED),
    collections: s.collections,
  });
  return true;
}

export async function listSaved(): Promise<SavedEntry[]> {
  return (await ensureLoaded()).entries;
}

// ---------- Collections ----------

export async function createCollection(name: string): Promise<Collection> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Collection name cannot be empty');
  const s = await ensureLoaded();
  if (s.collections.length >= MAX_COLLECTIONS) {
    throw new Error(`Collection limit (${MAX_COLLECTIONS}) reached`);
  }
  const collection: Collection = {
    id: Crypto.randomUUID(),
    name: trimmed,
    createdAt: new Date().toISOString(),
    articleIds: [],
  };
  commit({ entries: s.entries, collections: [...s.collections, collection] });
  return collection;
}

export async function deleteCollection(collectionId: string): Promise<void> {
  const s = await ensureLoaded();
  commit({
    entries: s.entries,
    collections: s.collections.filter((c) => c.id !== collectionId),
  });
}

/**
 * Add a card to a collection. Auto-saves the card to entries if it isn't
 * already saved — collections are groupings of saved cards, not parallel
 * storage.
 */
export async function addToCollection(card: Card, collectionId: string): Promise<void> {
  const s = await ensureLoaded();
  const collectionIdx = s.collections.findIndex((c) => c.id === collectionId);
  if (collectionIdx < 0) return;
  const collection = s.collections[collectionIdx]!;
  if (collection.articleIds.includes(card.articleId)) return; // already there

  // Auto-save if needed.
  const entries = s.entries.some((e) => e.card.articleId === card.articleId)
    ? s.entries
    : [{ card, savedAt: new Date().toISOString() }, ...s.entries].slice(0, MAX_SAVED);

  const collections = s.collections.toSpliced(collectionIdx, 1, {
    ...collection,
    articleIds: [card.articleId, ...collection.articleIds],
  });
  commit({ entries, collections });
}

export async function removeFromCollection(
  articleId: string,
  collectionId: string,
): Promise<void> {
  const s = await ensureLoaded();
  const collectionIdx = s.collections.findIndex((c) => c.id === collectionId);
  if (collectionIdx < 0) return;
  const collection = s.collections[collectionIdx]!;
  const collections = s.collections.toSpliced(collectionIdx, 1, {
    ...collection,
    articleIds: collection.articleIds.filter((id) => id !== articleId),
  });
  commit({ entries: s.entries, collections });
}

// ---------- React hooks ----------

export function useSavedIds(): ReadonlySet<string> {
  const [ids, setIds] = useState<ReadonlySet<string>>(() => new Set());
  useEffect(() => {
    let mounted = true;
    void ensureLoaded().then((s) => {
      if (mounted) setIds(new Set(s.entries.map((e) => e.card.articleId)));
    });
    const sub = (s: State) => setIds(new Set(s.entries.map((e) => e.card.articleId)));
    subscribers.add(sub);
    return () => {
      mounted = false;
      subscribers.delete(sub);
    };
  }, []);
  return ids;
}

export function useSavedList(): SavedEntry[] {
  const [entries, setEntries] = useState<SavedEntry[]>([]);
  useEffect(() => {
    let mounted = true;
    void ensureLoaded().then((s) => {
      if (mounted) setEntries(s.entries);
    });
    const sub = (s: State) => setEntries(s.entries);
    subscribers.add(sub);
    return () => {
      mounted = false;
      subscribers.delete(sub);
    };
  }, []);
  return entries;
}

export function useCollections(): Collection[] {
  const [cols, setCols] = useState<Collection[]>([]);
  useEffect(() => {
    let mounted = true;
    void ensureLoaded().then((s) => {
      if (mounted) setCols(s.collections);
    });
    const sub = (s: State) => setCols(s.collections);
    subscribers.add(sub);
    return () => {
      mounted = false;
      subscribers.delete(sub);
    };
  }, []);
  return cols;
}

export type { SavedEntry, Collection };
