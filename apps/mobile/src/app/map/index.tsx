import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import type { StyleProp, TextStyle } from 'react-native';
import { Feather as RawFeather } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tapImpact } from '@/lib/haptics';

const Feather = RawFeather as unknown as React.ComponentType<{
  name: string;
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
}>;

// Curated seed list. Each entry is a Wikipedia article title that
// produces a strong related-pages graph. Order within each section is
// alphabetical for clarity. We split continents from countries so the
// user can zoom by intent: pick a region (broad) or a country (narrow).
const CONTINENTS = [
  { label: 'Africa', seed: 'Africa', flag: '🌍' },
  { label: 'Asia', seed: 'Asia', flag: '🌏' },
  { label: 'Europe', seed: 'Europe', flag: '🌍' },
  { label: 'North America', seed: 'North America', flag: '🌎' },
  { label: 'Oceania', seed: 'Oceania', flag: '🌏' },
  { label: 'South America', seed: 'South America', flag: '🌎' },
] as const;

const COUNTRIES = [
  { label: 'Argentina', seed: 'Argentina', flag: '🇦🇷' },
  { label: 'Australia', seed: 'Australia', flag: '🇦🇺' },
  { label: 'Brazil', seed: 'Brazil', flag: '🇧🇷' },
  { label: 'Canada', seed: 'Canada', flag: '🇨🇦' },
  { label: 'China', seed: 'China', flag: '🇨🇳' },
  { label: 'Egypt', seed: 'Egypt', flag: '🇪🇬' },
  { label: 'France', seed: 'France', flag: '🇫🇷' },
  { label: 'Germany', seed: 'Germany', flag: '🇩🇪' },
  { label: 'Greece', seed: 'Greece', flag: '🇬🇷' },
  { label: 'India', seed: 'India', flag: '🇮🇳' },
  { label: 'Indonesia', seed: 'Indonesia', flag: '🇮🇩' },
  { label: 'Italy', seed: 'Italy', flag: '🇮🇹' },
  { label: 'Japan', seed: 'Japan', flag: '🇯🇵' },
  { label: 'Mexico', seed: 'Mexico', flag: '🇲🇽' },
  { label: 'Philippines', seed: 'Philippines', flag: '🇵🇭' },
  { label: 'Russia', seed: 'Russia', flag: '🇷🇺' },
  { label: 'South Africa', seed: 'South Africa', flag: '🇿🇦' },
  { label: 'South Korea', seed: 'South Korea', flag: '🇰🇷' },
  { label: 'Spain', seed: 'Spain', flag: '🇪🇸' },
  { label: 'Thailand', seed: 'Thailand', flag: '🇹🇭' },
  { label: 'Turkey', seed: 'Turkey', flag: '🇹🇷' },
  { label: 'United Kingdom', seed: 'United Kingdom', flag: '🇬🇧' },
  { label: 'United States', seed: 'United States', flag: '🇺🇸' },
  { label: 'Vietnam', seed: 'Vietnam', flag: '🇻🇳' },
] as const;

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [query, setQuery] = useState('');

  // Filter both lists case-insensitively. Used by the search field so the
  // user can jump to a place that isn't in our curated list — typing
  // anything submits to /map/region/<that-string>.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return { continents: CONTINENTS, countries: COUNTRIES };
    return {
      continents: CONTINENTS.filter((c) => c.label.toLowerCase().includes(q)),
      countries: COUNTRIES.filter((c) => c.label.toLowerCase().includes(q)),
    };
  }, [query]);

  const open = (seed: string) => {
    tapImpact();
    router.push(`/map/region?seed=${encodeURIComponent(seed)}` as never);
  };

  return (
    <View className="flex-1 bg-knowverse-deep">
      <Stack.Screen
        options={{
          title: 'Map',
          headerShown: true,
          headerStyle: { backgroundColor: '#05071a' },
          headerTintColor: '#e7e9ff',
          headerBackTitle: 'Back',
        }}
      />

      <View
        className="px-6"
        style={{ paddingTop: 8, paddingBottom: 12 }}
      >
        <Text className="text-knowverse-star text-2xl font-semibold">
          Explore by place
        </Text>
        <Text className="text-knowverse-star/60 mt-2 text-sm leading-relaxed">
          Tap a country or continent to see Wikipedia articles tied to it.
        </Text>

        <View className="mt-5 flex-row items-center gap-2 rounded-full bg-knowverse/60 px-4">
          <Feather name="search" size={16} color="#e7e9ff99" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search a country or place"
            placeholderTextColor="#e7e9ff55"
            className="text-knowverse-star flex-1 py-3 text-sm"
            autoCorrect={false}
            autoCapitalize="words"
            returnKeyType="search"
            onSubmitEditing={() => {
              const q = query.trim();
              if (q.length > 1) open(q);
            }}
          />
          {query.length > 0 && (
            <Pressable
              onPress={() => setQuery('')}
              accessibilityLabel="Clear search"
            >
              <Feather name="x" size={16} color="#e7e9ff99" />
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
      >
        {filtered.continents.length > 0 && (
          <Section title="Continents">
            <View className="flex-row flex-wrap gap-2 px-5 pt-1">
              {filtered.continents.map((c) => (
                <Pressable
                  key={c.seed}
                  onPress={() => open(c.seed)}
                  className="flex-row items-center gap-2 rounded-full border border-knowverse-star/15 bg-knowverse/40 px-4 py-2.5"
                >
                  <Text className="text-base">{c.flag}</Text>
                  <Text className="text-knowverse-star text-sm font-medium">
                    {c.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Section>
        )}

        {filtered.countries.length > 0 && (
          <Section title="Countries">
            <View className="flex-row flex-wrap gap-2 px-5 pt-1">
              {filtered.countries.map((c) => (
                <Pressable
                  key={c.seed}
                  onPress={() => open(c.seed)}
                  className="flex-row items-center gap-2 rounded-full border border-knowverse-star/15 bg-knowverse/40 px-4 py-2.5"
                >
                  <Text className="text-base">{c.flag}</Text>
                  <Text className="text-knowverse-star text-sm font-medium">
                    {c.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Section>
        )}

        {filtered.continents.length === 0 && filtered.countries.length === 0 && query.trim().length > 1 && (
          <View className="px-6 pt-8">
            <Text className="text-knowverse-star/60 text-sm">
              Not in our list — but we can still search Wikipedia for it.
            </Text>
            <Pressable
              onPress={() => open(query.trim())}
              className="bg-knowverse-star mt-4 self-start rounded-full px-5 py-2.5"
            >
              <Text className="text-knowverse-deep text-sm font-semibold">
                Show articles for "{query.trim()}"
              </Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mt-6">
      <Text className="text-knowverse-star/50 px-5 text-xs uppercase tracking-widest">
        {title}
      </Text>
      <View className="mt-3">{children}</View>
    </View>
  );
}
