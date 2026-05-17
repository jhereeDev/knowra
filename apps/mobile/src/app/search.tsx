import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { StyleProp, TextStyle } from 'react-native';
import { Image as RawExpoImage, type ImageProps as ExpoImageProps } from 'expo-image';
import { Feather as RawFeather } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { searchResponseSchema, type SearchResult } from '@knowra/shared';
import { tapImpact } from '@/lib/haptics';

const Image = RawExpoImage as unknown as React.ComponentType<ExpoImageProps>;
type FeatherProps = { name: string; size?: number; color?: string; style?: StyleProp<TextStyle> };
const Feather = RawFeather as unknown as React.ComponentType<FeatherProps>;

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
const DEBOUNCE_MS = 250;
const MIN_QUERY_LEN = 2;

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounce the input so we don't fire a search per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  // Fire the actual search.
  useEffect(() => {
    if (debounced.length < MIN_QUERY_LEN) {
      setResults([]);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/search?q=${encodeURIComponent(debounced)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: unknown = await res.json();
        const parsed = searchResponseSchema.parse(json);
        if (!cancelled) setResults(parsed.results);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setResults([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  const openArticle = useCallback((result: SearchResult) => {
    tapImpact();
    // Opening Wikipedia directly: the search modal doesn't have the full
    // Card payload (no extracted color, no LLM hook), so jumping into the
    // pager would be inconsistent. The reader is the right destination —
    // construct a minimal Wikipedia URL and let the user dive in.
    const slug = result.title.replace(/ /g, '_');
    const url = `https://en.wikipedia.org/wiki/${encodeURIComponent(slug)}`;
    void Linking.openURL(url);
  }, []);

  return (
    <View className="flex-1 bg-knowverse-deep" style={{ paddingTop: insets.top }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header: search input + cancel */}
      <View className="flex-row items-center gap-3 border-b border-knowverse-star/10 px-4 pb-3 pt-2">
        <View className="flex-1 flex-row items-center gap-2 rounded-xl bg-knowverse/40 px-3 py-2.5">
          <Feather name="search" size={16} color="rgba(231,233,255,0.5)" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search Wikipedia"
            placeholderTextColor="rgba(231, 233, 255, 0.3)"
            className="text-knowverse-star flex-1 text-base"
            autoFocus
            returnKeyType="search"
            clearButtonMode="while-editing"
            autoCorrect={false}
            autoCapitalize="none"
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <Feather name="x" size={16} color="rgba(231,233,255,0.5)" />
            </Pressable>
          )}
        </View>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text className="text-knowverse-star text-sm">Cancel</Text>
        </Pressable>
      </View>

      {/* Results / states */}
      {debounced.length < MIN_QUERY_LEN ? (
        <View className="flex-1 items-center justify-center px-8">
          <View className="h-20 w-20 items-center justify-center rounded-full bg-knowverse/40">
            <Feather name="search" size={32} color="rgba(231,233,255,0.45)" />
          </View>
          <Text className="text-knowverse-star/70 mt-5 text-center text-base">
            Search Wikipedia
          </Text>
          <Text className="text-knowverse-star/40 mt-2 text-center text-sm">
            Type at least 2 characters to find an article.
          </Text>
        </View>
      ) : loading && results.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#e7e9ff" />
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-red-300 text-sm">{error}</Text>
        </View>
      ) : results.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-knowverse-star/60 text-center text-sm">
            No results for &ldquo;{debounced}&rdquo;.
          </Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.wikiId}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => <SearchRow item={item} onPress={() => openArticle(item)} />}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        />
      )}
    </View>
  );
}

function SearchRow({ item, onPress }: { item: SearchResult; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="flex-row gap-3 px-4 py-3">
      <View
        style={{
          width: 56,
          height: 56,
          backgroundColor: '#0a1234',
          borderRadius: 8,
          overflow: 'hidden',
        }}
      >
        {item.thumbnailUrl ? (
          <Image
            source={{ uri: item.thumbnailUrl }}
            style={{ width: 56, height: 56 }}
            contentFit="cover"
            transition={120}
          />
        ) : (
          <View className="flex-1 items-center justify-center">
            <Feather name="file-text" size={20} color="rgba(231,233,255,0.25)" />
          </View>
        )}
      </View>
      <View className="flex-1 justify-center">
        <Text className="text-knowverse-star text-base font-medium" numberOfLines={1}>
          {item.title}
        </Text>
        {item.description && (
          <Text className="text-knowverse-star/50 mt-0.5 text-xs" numberOfLines={2}>
            {item.description}
          </Text>
        )}
      </View>
      <Feather
        name="chevron-right"
        size={18}
        color="rgba(231,233,255,0.4)"
        style={{ alignSelf: 'center' }}
      />
    </Pressable>
  );
}
