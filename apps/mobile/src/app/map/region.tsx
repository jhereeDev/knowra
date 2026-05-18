import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { cardBatchResponseSchema, type Card } from '@knowra/shared';
import { VerticalPager } from '@/components/VerticalPager';
import { CardView } from '@/components/CardView';
import { CardSkeleton } from '@/components/CardSkeleton';
import { getDeviceId } from '@/lib/device';
import { track, flush } from '@/lib/events';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

const INITIAL_BATCH = 5;
const REFILL_TRIGGER = 2;
const REFILL_BATCH = 5;
const QUICK_SKIP_MS = 1500;

type RegionItem = { kind: 'card'; key: string; card: Card };

// Per-region feed. Reads ?seed=<title> and pulls /api/cards/region
// with that seed. Reuses the standard VerticalPager + CardView so
// gestures, animations, and event tracking match the main feed.
export default function MapRegionScreen() {
  const params = useLocalSearchParams<{ seed?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const seed = typeof params.seed === 'string' ? params.seed : '';

  const [items, setItems] = useState<RegionItem[]>([]);
  const [index, setIndex] = useState(0);
  const [state, setState] = useState<'loading' | 'ready' | { error: string }>('loading');
  const [refilling, setRefilling] = useState(false);

  const fetchBatch = useCallback(async (count: number): Promise<Card[]> => {
    const deviceId = await getDeviceId();
    const res = await fetch(
      `${API_URL}/api/cards/region?seed=${encodeURIComponent(seed)}&count=${count}`,
      { headers: { 'X-Knowra-Device-Id': deviceId } },
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json: unknown = await res.json();
    const parsed = cardBatchResponseSchema.parse(json);
    return parsed.cards;
  }, [seed]);

  useEffect(() => {
    if (!seed) return;
    let cancelled = false;
    setState('loading');
    void (async () => {
      try {
        const batch = await fetchBatch(INITIAL_BATCH);
        if (cancelled) return;
        setItems(batch.map((c) => ({ kind: 'card', key: c.articleId, card: c })));
        setIndex(0);
        setState('ready');
      } catch (e) {
        if (cancelled) return;
        setState({ error: e instanceof Error ? e.message : String(e) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [seed, fetchBatch]);

  // Refill on low buffer — same pattern as the main feed but simpler
  // (no nudges, no quizzes, no feed-type switching).
  useEffect(() => {
    if (state !== 'ready') return;
    const ahead = items.length - 1 - index;
    if (ahead > REFILL_TRIGGER || refilling) return;
    setRefilling(true);
    void (async () => {
      try {
        const batch = await fetchBatch(REFILL_BATCH);
        const seen = new Set(items.map((i) => i.card.articleId));
        const fresh = batch.filter((c) => !seen.has(c.articleId));
        if (fresh.length > 0) {
          setItems((prev) => [
            ...prev,
            ...fresh.map((c) => ({ kind: 'card' as const, key: c.articleId, card: c })),
          ]);
        }
      } catch {
        /* silent — next swipe retries */
      } finally {
        setRefilling(false);
      }
    })();
  }, [items, index, state, refilling, fetchBatch]);

  const handleAdvance = (dwellMs: number) => {
    const current = items[index];
    if (current) {
      const isQuickSkip = dwellMs < QUICK_SKIP_MS;
      track(current.card.articleId, isQuickSkip ? 'quick_skip' : 'swipe_up', { dwellMs });
    }
    setIndex((i) => i + 1);
  };

  const handleGoBack = (dwellMs: number) => {
    const current = items[index];
    if (current) track(current.card.articleId, 'swipe_back', { dwellMs });
    setIndex((i) => Math.max(0, i - 1));
  };

  // Best-effort flush on unmount.
  useEffect(() => () => void flush(), []);

  return (
    <View className="flex-1 bg-knowverse-deep">
      <Stack.Screen
        options={{
          title: seed || 'Region',
          headerShown: true,
          headerStyle: { backgroundColor: '#05071a' },
          headerTintColor: '#e7e9ff',
          headerBackTitle: 'Map',
        }}
      />

      {state === 'loading' && <CardSkeleton />}

      {typeof state === 'object' && (
        <View
          className="flex-1 items-center justify-center px-8"
          style={{ paddingTop: insets.top }}
        >
          <Text className="text-red-300 text-sm">✗ {state.error}</Text>
          <Pressable
            onPress={() => router.back()}
            className="bg-knowverse-star/10 mt-6 rounded-full px-5 py-2"
          >
            <Text className="text-knowverse-star text-sm">Back to Map</Text>
          </Pressable>
        </View>
      )}

      {state === 'ready' && items.length > 0 && (
        <VerticalPager<RegionItem>
          prev={index > 0 ? items[index - 1] : undefined}
          current={items[index]}
          next={items[index + 1]}
          canGoBack={index > 0}
          onAdvance={handleAdvance}
          onGoBack={handleGoBack}
          renderItem={(item) => <CardView card={item.card} />}
          keyExtractor={(item) => item.key}
        />
      )}
    </View>
  );
}
