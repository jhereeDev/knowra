import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { StyleProp, TextStyle } from 'react-native';
import { Image as RawExpoImage, type ImageProps as ExpoImageProps } from 'expo-image';
import { Stack, useRouter } from 'expo-router';
import { Feather as RawFeather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  createCollection,
  deleteCollection,
  reloadFromDisk,
  toggleSaved,
  useCollections,
  useSavedList,
  type SavedEntry,
} from '@/lib/savedArticles';

const Image = RawExpoImage as unknown as React.ComponentType<ExpoImageProps>;
type FeatherProps = { name: string; size?: number; color?: string; style?: StyleProp<TextStyle> };
const Feather = RawFeather as unknown as React.ComponentType<FeatherProps>;

const ALL_TAB = '__all__';
const SEARCH_DEBOUNCE_MS = 150;

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, '');
}

export default function SavedScreen() {
  const entries = useSavedList();
  const collections = useCollections();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<string>(ALL_TAB);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [searchRaw, setSearchRaw] = useState('');
  const [search, setSearch] = useState('');

  // Debounce search by 150ms so each keystroke doesn't rebuild the filter.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchRaw.trim().toLowerCase()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchRaw]);

  const filteredEntries: SavedEntry[] = useMemo(() => {
    let base = entries;
    if (activeTab !== ALL_TAB) {
      const col = collections.find((c) => c.id === activeTab);
      if (col) {
        const idSet = new Set(col.articleIds);
        const byId = new Map(entries.map((e) => [e.card.articleId, e]));
        base = col.articleIds
          .map((id) => byId.get(id))
          .filter((e): e is SavedEntry => e !== undefined && idSet.has(e.card.articleId));
      }
    }
    if (!search) return base;
    return base.filter((e) => {
      const title = stripHtml(e.card.title).toLowerCase();
      const subtitle = (e.card.subtitle ?? '').toLowerCase();
      return title.includes(search) || subtitle.includes(search);
    });
  }, [activeTab, entries, collections, search]);

  const activeCollectionName =
    activeTab === ALL_TAB ? 'All Saved' : collections.find((c) => c.id === activeTab)?.name;

  const onCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      const col = await createCollection(name);
      setActiveTab(col.id);
      setNewName('');
      setCreateOpen(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not create collection';
      Alert.alert('Cannot create collection', msg);
    }
  };

  const onDeleteCurrentCollection = () => {
    if (activeTab === ALL_TAB) return;
    const col = collections.find((c) => c.id === activeTab);
    if (!col) return;
    Alert.alert(
      `Delete "${col.name}"?`,
      'The articles inside stay in All Saved. This only removes the collection.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteCollection(col.id);
            setActiveTab(ALL_TAB);
          },
        },
      ],
    );
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // Actually re-read from disk + give the spinner enough time to be
    // visible (you can't perceive a 350ms refresh; 700ms reads as
    // "yes it did something").
    const start = Date.now();
    await reloadFromDisk();
    const elapsed = Date.now() - start;
    const remaining = Math.max(0, 700 - elapsed);
    if (remaining > 0) await new Promise((r) => setTimeout(r, remaining));
    setRefreshing(false);
  }, []);

  return (
    <View className="flex-1 bg-knowverse-deep">
      <Stack.Screen
        options={{
          title: 'Saved',
          headerShown: true,
          headerStyle: { backgroundColor: '#05071a' },
          headerTintColor: '#e7e9ff',
          headerBackTitle: 'Back',
          headerRight: () =>
            activeTab !== ALL_TAB ? (
              <Pressable onPress={onDeleteCurrentCollection} accessibilityLabel="Delete collection">
                <Text className="text-red-300 mr-2 text-sm">Delete</Text>
              </Pressable>
            ) : null,
        }}
      />

      {/* Search bar — always visible when there's at least one saved entry */}
      {entries.length > 0 && (
        <View className="px-4 pt-3">
          <View className="flex-row items-center gap-2 rounded-xl bg-knowverse/40 px-3 py-2.5">
            <Feather name="search" size={16} color="rgba(231,233,255,0.4)" />
            <TextInput
              value={searchRaw}
              onChangeText={setSearchRaw}
              placeholder="Search saved articles"
              placeholderTextColor="rgba(231, 233, 255, 0.3)"
              className="text-knowverse-star flex-1 text-base"
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
            {searchRaw.length > 0 && (
              <Pressable onPress={() => setSearchRaw('')} hitSlop={8}>
                <Feather name="x" size={16} color="rgba(231,233,255,0.5)" />
              </Pressable>
            )}
          </View>
        </View>
      )}

      {/* Tab strip */}
      <View style={{ height: 52 }} className="border-b border-knowverse-star/5">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 12, alignItems: 'center', gap: 8 }}
        >
          <Tab
            label="All"
            count={entries.length}
            active={activeTab === ALL_TAB}
            onPress={() => setActiveTab(ALL_TAB)}
          />
          {collections.map((c) => (
            <Tab
              key={c.id}
              label={c.name}
              count={c.articleIds.length}
              active={activeTab === c.id}
              onPress={() => setActiveTab(c.id)}
            />
          ))}
          <Pressable
            onPress={() => setCreateOpen(true)}
            accessibilityLabel="New collection"
            className="rounded-full border border-knowverse-star/20 px-4 py-2"
          >
            <Text className="text-knowverse-star/70 text-sm">+ New</Text>
          </Pressable>
        </ScrollView>
      </View>

      {filteredEntries.length === 0 ? (
        <EmptyState
          variant={
            search
              ? 'search'
              : entries.length === 0
                ? 'all-empty'
                : 'collection-empty'
          }
          collectionName={activeCollectionName ?? ''}
          searchTerm={searchRaw}
          onBack={() => router.back()}
          onClearSearch={() => setSearchRaw('')}
        />
      ) : (
        <FlatList
          data={filteredEntries}
          keyExtractor={(item) => item.card.articleId}
          renderItem={({ item }) => <Row entry={item} />}
          contentContainerStyle={{ paddingBottom: insets.bottom + 32, paddingTop: 8 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#e7e9ff"
              colors={['#e7e9ff']}
            />
          }
          keyboardShouldPersistTaps="handled"
        />
      )}

      {/* Create-collection modal */}
      <Modal
        visible={createOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCreateOpen(false)}
      >
        <Pressable
          onPress={() => setCreateOpen(false)}
          className="flex-1 items-center justify-center bg-knowverse-deep/80 px-8"
        >
          <Pressable
            onPress={() => {}}
            className="w-full rounded-2xl bg-knowverse-deep border border-knowverse-star/10 p-5"
          >
            <Text className="text-knowverse-star text-lg font-semibold">New collection</Text>
            <Text className="text-knowverse-star/50 mt-1 text-xs">
              Name it whatever you like. You can change it later.
            </Text>
            <TextInput
              value={newName}
              onChangeText={setNewName}
              autoFocus
              placeholder="e.g. Read later, Beautiful things"
              placeholderTextColor="rgba(231, 233, 255, 0.3)"
              returnKeyType="done"
              onSubmitEditing={() => void onCreate()}
              className="text-knowverse-star bg-knowverse/40 mt-4 rounded-xl px-4 py-3 text-base"
            />
            <View className="mt-4 flex-row justify-end gap-3">
              <Pressable onPress={() => setCreateOpen(false)} className="px-4 py-2">
                <Text className="text-knowverse-star/70 text-sm">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => void onCreate()}
                disabled={!newName.trim()}
                className={`rounded-full px-5 py-2 ${
                  newName.trim() ? 'bg-knowverse-star' : 'bg-knowverse-star/20'
                }`}
              >
                <Text
                  className={`text-sm font-semibold ${
                    newName.trim() ? 'text-knowverse-deep' : 'text-knowverse-star/40'
                  }`}
                >
                  Create
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function Tab({
  label,
  count,
  active,
  onPress,
}: {
  label: string;
  count: number;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center gap-2 rounded-full px-4 py-1.5 ${
        active ? 'bg-knowverse-star' : 'bg-knowverse/60'
      }`}
    >
      <Text
        className={`text-sm font-medium ${active ? 'text-knowverse-deep' : 'text-knowverse-star/70'}`}
      >
        {label}
      </Text>
      <Text className={`text-xs ${active ? 'text-knowverse-deep/60' : 'text-knowverse-star/40'}`}>
        {count}
      </Text>
    </Pressable>
  );
}

function EmptyState({
  variant,
  collectionName,
  searchTerm,
  onBack,
  onClearSearch,
}: {
  variant: 'all-empty' | 'collection-empty' | 'search';
  collectionName: string;
  searchTerm: string;
  onBack: () => void;
  onClearSearch: () => void;
}) {
  const config = {
    'all-empty': {
      icon: 'bookmark',
      title: 'No saved articles yet',
      body: 'Tap the bookmark on any card to save it. Long-press to add it to a collection.',
      actionLabel: 'Back to feed',
      onAction: onBack,
    },
    'collection-empty': {
      icon: 'folder',
      title: `${collectionName} is empty`,
      body: 'Long-press the bookmark on a card to add it to this collection.',
      actionLabel: 'Back to feed',
      onAction: onBack,
    },
    'search': {
      icon: 'search',
      title: 'No matches',
      body: `Nothing here matches "${searchTerm}".`,
      actionLabel: 'Clear search',
      onAction: onClearSearch,
    },
  }[variant];

  return (
    <View className="flex-1 items-center justify-center px-10">
      <View className="h-20 w-20 items-center justify-center rounded-full bg-knowverse/40">
        <Feather name={config.icon} size={32} color="rgba(231,233,255,0.5)" />
      </View>
      <Text className="text-knowverse-star mt-6 text-xl font-semibold">{config.title}</Text>
      <Text className="text-knowverse-star/50 mt-2 text-center text-sm leading-relaxed">
        {config.body}
      </Text>
      <Pressable
        onPress={config.onAction}
        className="bg-knowverse-star/10 mt-8 rounded-full px-5 py-2"
      >
        <Text className="text-knowverse-star text-sm">{config.actionLabel}</Text>
      </Pressable>
    </View>
  );
}

function Row({ entry }: { entry: SavedEntry }) {
  const { card } = entry;
  const title = stripHtml(card.title);

  return (
    <View className="flex-row gap-3 px-4 py-3">
      <Pressable
        onPress={() => void Linking.openURL(card.wikipediaUrl)}
        className="flex-1 flex-row gap-3"
      >
        <View
          style={{
            width: 72,
            height: 72,
            backgroundColor: card.image?.dominantColor ?? '#0a0e27',
            borderRadius: 10,
            overflow: 'hidden',
          }}
        >
          {card.image && (
            <Image
              source={{ uri: card.image.url }}
              style={{ width: 72, height: 72 }}
              contentFit="cover"
              transition={150}
            />
          )}
        </View>
        <View className="flex-1 justify-center">
          <Text className="text-knowverse-star text-base font-medium" numberOfLines={2}>
            {title}
          </Text>
          {card.subtitle && (
            <Text className="text-knowverse-star/50 mt-1 text-xs" numberOfLines={1}>
              {card.subtitle}
            </Text>
          )}
        </View>
      </Pressable>
      <Pressable
        onPress={() => void toggleSaved(card)}
        accessibilityLabel="Remove from saved"
        className="self-center px-3"
      >
        <Feather name="bookmark" size={18} color="rgba(231,233,255,0.6)" />
      </Pressable>
    </View>
  );
}
