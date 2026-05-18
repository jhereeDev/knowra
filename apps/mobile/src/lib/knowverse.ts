import { useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import type { Card } from '@knowra/shared';

// The Knowverse graph: a personal map of articles the user has engaged
// with and the rabbit-hole links between them. Stored entirely on the
// device — no backend dependency. Two records:
//
//   - stars: every article the user has saved or actively engaged with
//     (long-dwell, "More like this" tap, etc.). We dedupe by articleId
//     and keep a snapshot of the Card so the graph survives even if
//     the backend ever loses the article row.
//
//   - edges: directed links from one article to another. Added when
//     the user taps "More like this" from inside an article — the
//     source-of-the-rabbit-hole becomes the edge origin.
//
// The graph is read-only outside of the recording functions exported
// here; the visualization layer reads via the `useKnowverse` hook.

const STORAGE_KEY = 'knowra.knowverse_graph_v1';
const MAX_STARS = 500; // hard cap so the graph doesn't grow unboundedly
const MAX_EDGES = 2000;

export type KnowverseStar = {
  articleId: string;
  wikiId: string;
  title: string;
  subtitle: string | null;
  categories: string[];
  imageDominantColor: string | null;
  imageUrl: string | null;
  wikipediaUrl: string;
  addedAt: string;
};

export type KnowverseEdge = {
  fromArticleId: string;
  toArticleId: string;
  addedAt: string;
};

export type KnowverseGraph = {
  stars: KnowverseStar[];
  edges: KnowverseEdge[];
};

const EMPTY_GRAPH: KnowverseGraph = { stars: [], edges: [] };

let cache: KnowverseGraph | null = null;
let loadPromise: Promise<KnowverseGraph> | null = null;
const subscribers = new Set<(g: KnowverseGraph) => void>();

async function loadFromDisk(): Promise<KnowverseGraph> {
  const raw = await SecureStore.getItemAsync(STORAGE_KEY);
  if (!raw) return EMPTY_GRAPH;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === 'object' &&
      'stars' in parsed &&
      'edges' in parsed
    ) {
      const p = parsed as { stars: unknown; edges: unknown };
      if (Array.isArray(p.stars) && Array.isArray(p.edges)) {
        return {
          stars: p.stars as KnowverseStar[],
          edges: p.edges as KnowverseEdge[],
        };
      }
    }
  } catch {
    /* corrupt — reset */
  }
  return EMPTY_GRAPH;
}

async function ensureLoaded(): Promise<KnowverseGraph> {
  if (cache) return cache;
  loadPromise ??= loadFromDisk();
  cache = await loadPromise;
  return cache;
}

function commit(next: KnowverseGraph): void {
  cache = next;
  for (const sub of subscribers) sub(next);
  void SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
}

function cardToStar(card: Card): KnowverseStar {
  return {
    articleId: card.articleId,
    wikiId: card.wikiId,
    title: card.title,
    subtitle: card.subtitle,
    categories: card.categories ?? [],
    imageDominantColor: card.image?.dominantColor ?? null,
    imageUrl: card.image?.url ?? null,
    wikipediaUrl: card.wikipediaUrl,
    addedAt: new Date().toISOString(),
  };
}

/**
 * Add (or refresh) a star for an article the user has engaged with.
 * Idempotent: existing stars are touched-up with a fresher addedAt so
 * the visualization can fade older stars without losing them entirely.
 */
export async function recordKnowverseStar(card: Card): Promise<void> {
  const g = await ensureLoaded();
  const idx = g.stars.findIndex((s) => s.articleId === card.articleId);
  let stars: KnowverseStar[];
  if (idx >= 0) {
    stars = g.stars.slice();
    const existing = stars[idx]!;
    stars[idx] = { ...existing, addedAt: new Date().toISOString() };
  } else {
    stars = [cardToStar(card), ...g.stars].slice(0, MAX_STARS);
  }
  commit({ stars, edges: g.edges });
}

/**
 * Record a directed edge between two articles — e.g. when the user
 * taps "More like this" inside the in-app reader. Both ends are
 * silently ignored if either side isn't already a star.
 */
export async function recordKnowverseEdge(
  fromArticleId: string,
  toArticleId: string,
): Promise<void> {
  if (fromArticleId === toArticleId) return;
  const g = await ensureLoaded();
  const haveBoth =
    g.stars.some((s) => s.articleId === fromArticleId) &&
    g.stars.some((s) => s.articleId === toArticleId);
  if (!haveBoth) return;
  // De-duplicate by (from,to) so repeated taps don't pile up.
  if (
    g.edges.some(
      (e) => e.fromArticleId === fromArticleId && e.toArticleId === toArticleId,
    )
  ) {
    return;
  }
  const edges = [
    { fromArticleId, toArticleId, addedAt: new Date().toISOString() },
    ...g.edges,
  ].slice(0, MAX_EDGES);
  commit({ stars: g.stars, edges });
}

export function useKnowverse(): KnowverseGraph {
  const [graph, setGraph] = useState<KnowverseGraph>(EMPTY_GRAPH);
  useEffect(() => {
    let mounted = true;
    void ensureLoaded().then((g) => {
      if (mounted) setGraph(g);
    });
    const sub = (g: KnowverseGraph) => setGraph(g);
    subscribers.add(sub);
    return () => {
      mounted = false;
      subscribers.delete(sub);
    };
  }, []);
  return graph;
}
