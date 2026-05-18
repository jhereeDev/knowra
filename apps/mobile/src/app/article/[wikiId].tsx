import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import type { StyleProp, TextStyle } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Feather as RawFeather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { randomCardResponseSchema, type Card } from '@knowra/shared';
import { CardView } from '@/components/CardView';
import { getDeviceId } from '@/lib/device';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

// React-19 JSX-class cast (same recurring pattern).
type FeatherProps = { name: string; size?: number; color?: string; style?: StyleProp<TextStyle> };
const Feather = RawFeather as unknown as React.ComponentType<FeatherProps>;

/**
 * Standalone single-article screen, reached by tapping a push notification.
 * Fetches one card by Wikipedia page id and renders it with the same
 * CardView used by the feed. A close button in the top-left dismisses
 * back to the main feed — there is no swipe-up here (no next card to
 * page to).
 */
export default function ArticleScreen() {
  const { wikiId } = useLocalSearchParams<{ wikiId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [card, setCard] = useState<Card | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!wikiId) return;
    let cancelled = false;

    void (async () => {
      try {
        const deviceId = await getDeviceId();
        const res = await fetch(`${API_URL}/api/cards/by-wiki/${wikiId}`, {
          headers: { 'X-Knowra-Device-Id': deviceId },
        });
        if (!res.ok) {
          if (!cancelled) setError(`Couldn’t load article (${res.status})`);
          return;
        }
        const json: unknown = await res.json();
        const parsed = randomCardResponseSchema.parse(json);
        if (!cancelled) setCard(parsed.card);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load article');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [wikiId]);

  const goHome = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <View className="flex-1 bg-knowverse-deep">
      <Stack.Screen options={{ headerShown: false }} />
      {card ? (
        <CardView card={card} />
      ) : (
        <View className="flex-1 items-center justify-center px-8">
          {error ? (
            <>
              <Text className="text-knowverse-star/80 text-center text-base">{error}</Text>
              <Pressable onPress={goHome} className="mt-6 rounded-full border border-knowverse-star/30 px-5 py-2">
                <Text className="text-knowverse-star text-sm font-semibold">Back to feed</Text>
              </Pressable>
            </>
          ) : (
            <>
              <ActivityIndicator color="#e7e9ff" />
              <Text className="text-knowverse-star/55 mt-3 text-xs">opening article…</Text>
            </>
          )}
        </View>
      )}

      {/* Close button — top-left, sits above the card chrome. */}
      <Pressable
        onPress={goHome}
        accessibilityLabel="Back to feed"
        hitSlop={10}
        style={{ position: 'absolute', top: insets.top + 12, left: 16 }}
        className="h-9 w-9 items-center justify-center rounded-full bg-black/45 border border-white/15"
      >
        <Feather name="x" size={18} color="#e7e9ff" />
      </Pressable>
    </View>
  );
}
