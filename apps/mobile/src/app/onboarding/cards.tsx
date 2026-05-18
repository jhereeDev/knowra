import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import type { StyleProp, TextStyle } from 'react-native';
import { Image as RawExpoImage, type ImageProps as ExpoImageProps } from 'expo-image';
import { LinearGradient as RawLinearGradient } from 'expo-linear-gradient';
import { Feather as RawFeather } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { cardBatchResponseSchema, type Card } from '@knowra/shared';
import { getDeviceId } from '@/lib/device';
import { getTopicPrefs } from '@/lib/topicPrefs';
import { toggleSaved } from '@/lib/savedArticles';
import { track, flush } from '@/lib/events';
import { markCalibrated } from '@/lib/onboarding';
import { tapImpact } from '@/lib/haptics';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

// Recurring React-19 JSX-class shims.
const Image = RawExpoImage as unknown as React.ComponentType<ExpoImageProps>;
type LinearGradientProps = {
  colors: readonly [string, string, ...string[]];
  locations?: readonly number[];
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  style?: import('react-native').StyleProp<import('react-native').ViewStyle>;
  children?: React.ReactNode;
};
const LinearGradient = RawLinearGradient as unknown as React.ComponentType<LinearGradientProps>;
type FeatherIconProps = {
  name: string;
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
};
const Feather = RawFeather as unknown as React.ComponentType<FeatherIconProps>;

// Onboarding step 2 of 2. Fetch 3 cards seeded by the user's picked
// topics, present them one at a time with explicit Save / Skip
// buttons (no swipe gestures — we want the user to see the controls
// they'll have later, and the gesture hint comes from /index.tsx).
//
// Each Save / Skip emits an event so For You has warm signal from
// turn one. After the third card, mark calibrated and route to the
// feed proper.
export default function OnboardingCardsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [cards, setCards] = useState<Card[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);

  const finish = useCallback(async () => {
    await markCalibrated();
    // Best-effort flush so the calibration events make it to the
    // backend before the user reaches the feed (For You's first
    // request reads them server-side).
    await flush().catch(() => {});
    router.replace('/');
  }, [router]);

  // Fetch on mount. Uses /api/cards/foryou with the topics header so
  // server-side seeding kicks in (no engagement events exist yet, but
  // topics are enough to ground the related-pages query).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [deviceId, topics] = await Promise.all([getDeviceId(), getTopicPrefs()]);
        const headers: Record<string, string> = { 'X-Knowra-Device-Id': deviceId };
        if (topics.length > 0) {
          headers['X-Knowra-Topics'] = topics.map((t) => t.toLowerCase()).join(',');
        }
        const res = await fetch(`${API_URL}/api/cards/foryou?count=3`, { headers });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: unknown = await res.json();
        const parsed = cardBatchResponseSchema.parse(json);
        if (!cancelled) setCards(parsed.cards.slice(0, 3));
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const current = cards?.[idx];

  const advance = (action: 'save' | 'skip') => {
    if (!current) return;
    tapImpact();
    if (action === 'save') {
      void toggleSaved(current);
      track(current.articleId, 'save');
    } else {
      track(current.articleId, 'quick_skip', { dwellMs: 0 });
    }
    if (idx + 1 >= (cards?.length ?? 0)) {
      void finish();
    } else {
      setIdx(idx + 1);
    }
  };

  return (
    <View className="flex-1 bg-knowverse-deep">
      <Stack.Screen options={{ headerShown: false }} />

      <View
        className="px-6"
        style={{ paddingTop: insets.top + 16 }}
      >
        <Text className="text-knowverse-star/40 text-xs uppercase tracking-widest">
          Step 2 of 2
        </Text>
        <View className="mt-2 flex-row items-center justify-between">
          <Text className="text-knowverse-star text-2xl font-semibold">
            Calibrate your feed
          </Text>
          <Pressable
            onPress={() => void finish()}
            accessibilityLabel="Skip calibration"
            className="px-2 py-1"
          >
            <Text className="text-knowverse-star/40 text-sm underline">Skip</Text>
          </Pressable>
        </View>
        <Text className="text-knowverse-star/60 mt-2 text-sm">
          Three picks. Save the ones that catch your eye.
        </Text>

        {/* Progress dots */}
        <View className="mt-4 flex-row gap-1.5">
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              className={`h-1 flex-1 rounded-full ${
                i <= idx ? 'bg-knowverse-star' : 'bg-knowverse-star/15'
              }`}
            />
          ))}
        </View>
      </View>

      {!cards && !error && (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#e7e9ff" />
          <Text className="text-knowverse-star/50 mt-4 text-sm">
            Finding articles for you…
          </Text>
        </View>
      )}

      {error && (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-red-300 text-sm">{error}</Text>
          <Pressable
            onPress={() => void finish()}
            className="bg-knowverse-star/10 mt-6 rounded-full px-5 py-2"
          >
            <Text className="text-knowverse-star text-sm">Skip and continue</Text>
          </Pressable>
        </View>
      )}

      {current && (
        <View className="flex-1 px-5 pt-6">
          <View className="flex-1 overflow-hidden rounded-3xl bg-knowverse/40">
            {current.image && (
              <View
                style={{
                  backgroundColor: current.image.dominantColor ?? '#0b0e24',
                }}
                className="h-[58%] w-full"
              >
                <Image
                  source={{ uri: current.image.url }}
                  contentFit="cover"
                  style={{ width: '100%', height: '100%' }}
                  recyclingKey={current.articleId}
                />
                <LinearGradient
                  colors={['transparent', 'rgba(5,7,26,0.95)']}
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: 0,
                    height: '55%',
                  }}
                />
              </View>
            )}
            <View
              className="absolute bottom-0 left-0 right-0 px-5 pb-5"
              pointerEvents="none"
            >
              <Text
                className="text-knowverse-star text-2xl font-semibold"
                numberOfLines={2}
              >
                {current.title}
              </Text>
              {current.subtitle && (
                <Text
                  className="text-knowverse-star/70 mt-1 text-sm"
                  numberOfLines={1}
                >
                  {current.subtitle}
                </Text>
              )}
              <Text
                className="text-knowverse-star/80 mt-3 text-sm leading-relaxed"
                numberOfLines={4}
              >
                {current.hook}
              </Text>
            </View>
          </View>

          <View
            className="flex-row gap-3 pt-5"
            style={{ paddingBottom: insets.bottom + 16 }}
          >
            <Pressable
              onPress={() => advance('skip')}
              accessibilityLabel="Skip this article"
              className="flex-1 flex-row items-center justify-center gap-2 rounded-full border border-knowverse-star/25 bg-knowverse/40 py-4"
            >
              <Feather name="x" size={18} color="#e7e9ff" />
              <Text className="text-knowverse-star text-base font-semibold">
                Skip
              </Text>
            </Pressable>
            <Pressable
              onPress={() => advance('save')}
              accessibilityLabel="Save this article"
              className="bg-knowverse-star flex-1 flex-row items-center justify-center gap-2 rounded-full py-4"
            >
              <Feather name="bookmark" size={18} color="#05071a" />
              <Text className="text-knowverse-deep text-base font-semibold">
                Save
              </Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}
