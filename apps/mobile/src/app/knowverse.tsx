import { useMemo, useState } from 'react';
import {
  Dimensions,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Card } from '@knowra/shared';
import { useKnowverse, type KnowverseStar, type KnowverseEdge } from '@/lib/knowverse';
import { ArticleReader } from '@/components/ArticleReader';
import { tapImpact } from '@/lib/haptics';

const STAR_BASE_SIZE = 12;
const STAR_MAX_SIZE = 22;
const PADDING = 24;
// How long ago "newest" should be considered. Stars older than this
// still render but at minimum brightness. Two weeks gives a long-tail
// fade without making month-old reads invisible.
const RECENCY_FADE_MS = 14 * 24 * 60 * 60 * 1000;

// Deterministic 32-bit hash → number in [0, 1). Pure helper; identical
// inputs always produce identical positions so the constellation is
// stable across launches (a star you saw in the top-right today is
// still in the top-right tomorrow).
function hash01(input: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // Normalize to [0, 1) by mapping into a positive uint32.
  return ((h >>> 0) % 100000) / 100000;
}

type LaidOutStar = KnowverseStar & {
  x: number;
  y: number;
  size: number;
  brightness: number;
};

// Polar-coord layout with hash-derived angle + radius, clustered by
// the article's first category (same category → similar angle band).
// Result: a constellation that's deterministic but visually varied.
function layout(
  stars: KnowverseStar[],
  width: number,
  height: number,
): LaidOutStar[] {
  if (stars.length === 0 || width <= 0 || height <= 0) return [];
  const cx = width / 2;
  const cy = height / 2;
  // Inner ring radius slightly smaller than the smaller dimension so
  // stars never hit the edge.
  const maxRadius = Math.min(width, height) / 2 - PADDING - STAR_MAX_SIZE;
  const now = Date.now();
  const byCategoryAngle = new Map<string, number>();

  return stars.map((star) => {
    const cat = star.categories[0] ?? '_';
    // Lock the category to an angle band so same-topic stars cluster.
    let bandAngle = byCategoryAngle.get(cat);
    if (bandAngle === undefined) {
      bandAngle = hash01(cat, 1) * Math.PI * 2;
      byCategoryAngle.set(cat, bandAngle);
    }
    // Jitter within the band so individual stars don't overlap.
    const jitter = (hash01(star.articleId, 7) - 0.5) * (Math.PI / 4);
    const angle = bandAngle + jitter;
    const radius = (0.25 + hash01(star.articleId, 13) * 0.75) * maxRadius;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    // Brightness fades with age — newer stars glow brighter.
    const ageMs = Math.max(0, now - Date.parse(star.addedAt));
    const brightness = Math.max(0.25, 1 - ageMs / RECENCY_FADE_MS);
    const sizeT = hash01(star.articleId, 21);
    const size = STAR_BASE_SIZE + sizeT * (STAR_MAX_SIZE - STAR_BASE_SIZE);
    return { ...star, x, y, size, brightness };
  });
}

type Vec = { x: number; y: number };

function lineProps(a: Vec, b: Vec) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  return { left: a.x, top: a.y, width: length, angle };
}

export default function KnowverseScreen() {
  const insets = useSafeAreaInsets();
  const graph = useKnowverse();
  const [canvas, setCanvas] = useState({ width: 0, height: 0 });
  const [openStar, setOpenStar] = useState<KnowverseStar | null>(null);

  const stars = useMemo(
    () => layout(graph.stars, canvas.width, canvas.height),
    [graph.stars, canvas.width, canvas.height],
  );
  const byId = useMemo(() => {
    const m = new Map<string, LaidOutStar>();
    for (const s of stars) m.set(s.articleId, s);
    return m;
  }, [stars]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== canvas.width || height !== canvas.height) {
      setCanvas({ width, height });
    }
  };

  // Synthesize a Card for the reader when a star is tapped. We don't
  // have the full Card snapshot stored (only the metadata we need for
  // visualization), but the reader only needs articleId/wikiId/title
  // plus the URL — everything else has reasonable defaults.
  const readerCard: Card | null = useMemo(() => {
    if (!openStar) return null;
    return {
      articleId: openStar.articleId,
      wikiId: openStar.wikiId,
      lang: 'en',
      title: openStar.title,
      subtitle: openStar.subtitle,
      hook: '',
      image:
        openStar.imageUrl
          ? {
              url: openStar.imageUrl,
              width: 800,
              height: 600,
              dominantColor: openStar.imageDominantColor,
            }
          : null,
      categories: openStar.categories,
      wikipediaUrl: openStar.wikipediaUrl,
      attribution: 'CC BY-SA 4.0 — Wikipedia',
      fetchedAt: new Date().toISOString(),
    };
  }, [openStar]);

  const empty = graph.stars.length === 0;

  return (
    <View className="flex-1 bg-knowverse-deep">
      <Stack.Screen
        options={{
          title: 'Knowverse',
          headerShown: true,
          headerStyle: { backgroundColor: '#05071a' },
          headerTintColor: '#e7e9ff',
          headerBackTitle: 'Back',
        }}
      />

      <View
        className="px-6 pt-3 pb-2"
        style={{ borderBottomColor: '#e7e9ff10', borderBottomWidth: 1 }}
      >
        <Text className="text-knowverse-star text-xl font-semibold">
          Your knowverse
        </Text>
        <Text className="text-knowverse-star/55 mt-1 text-xs">
          {empty
            ? 'Save articles and follow rabbit holes to grow your map.'
            : `${graph.stars.length} ${graph.stars.length === 1 ? 'star' : 'stars'} · ${graph.edges.length} ${graph.edges.length === 1 ? 'link' : 'links'}`}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingBottom: insets.bottom + 24,
        }}
      >
        <View
          onLayout={onLayout}
          className="flex-1"
          style={{ minHeight: 520, position: 'relative' }}
        >
          {empty && canvas.width > 0 && <EmptyKnowverse />}

          {/* Edges drawn first so stars paint on top. Edges are hidden
              when either endpoint is missing from the laid-out set. */}
          {graph.edges.map((e) => (
            <EdgeLine key={`${e.fromArticleId}->${e.toArticleId}`} edge={e} byId={byId} />
          ))}

          {/* Stars — pressable. */}
          {stars.map((s) => (
            <StarNode
              key={s.articleId}
              star={s}
              onPress={() => {
                tapImpact();
                setOpenStar(s);
              }}
            />
          ))}
        </View>
      </ScrollView>

      <ArticleReader card={readerCard} onClose={() => setOpenStar(null)} />
    </View>
  );
}

function StarNode({ star, onPress }: { star: LaidOutStar; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={`Open ${star.title}`}
      hitSlop={8}
      style={{
        position: 'absolute',
        left: star.x - star.size / 2,
        top: star.y - star.size / 2,
        width: star.size,
        height: star.size,
        borderRadius: star.size / 2,
        backgroundColor: `rgba(231, 233, 255, ${star.brightness})`,
        // Soft outer ring to read against the deep-space background.
        borderWidth: 1,
        borderColor: `rgba(231, 233, 255, ${0.15 * star.brightness})`,
        // shadow* is iOS, elevation is Android — we don't worry about
        // the visual difference, the star reads as a glow on both.
        shadowColor: '#a8b4ff',
        shadowOpacity: 0.5 * star.brightness,
        shadowRadius: star.size,
      }}
    />
  );
}

function EdgeLine({
  edge,
  byId,
}: {
  edge: KnowverseEdge;
  byId: Map<string, LaidOutStar>;
}) {
  const a = byId.get(edge.fromArticleId);
  const b = byId.get(edge.toArticleId);
  if (!a || !b) return null;
  const { left, top, width, angle } = lineProps(a, b);
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left,
        top,
        width,
        height: 1,
        backgroundColor: 'rgba(168, 180, 255, 0.18)',
        transform: [{ rotate: `${angle}deg` }],
        transformOrigin: '0 0',
      }}
    />
  );
}

function EmptyKnowverse() {
  return (
    <View className="absolute inset-0 items-center justify-center px-8">
      <Text className="text-knowverse-star/70 text-center text-base leading-relaxed">
        Your knowverse is empty.
      </Text>
      <Text className="text-knowverse-star/45 mt-3 text-center text-sm leading-relaxed">
        Save articles and tap "More like this" inside a reader to start
        drawing constellations from your reading.
      </Text>
    </View>
  );
}
