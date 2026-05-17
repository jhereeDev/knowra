import { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Card } from '@knowra/shared';
import {
  addToCollection,
  createCollection,
  removeFromCollection,
  toggleSaved,
  useCollections,
  useSavedIds,
} from '@/lib/savedArticles';
import { track } from '@/lib/events';

type Props = {
  card: Card | null; // null = modal hidden
  onClose: () => void;
};

export function CollectionPicker({ card, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const collections = useCollections();
  const savedIds = useSavedIds();
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  const visible = card !== null;
  const isSaved = card !== null && savedIds.has(card.articleId);

  const onCreate = async () => {
    if (!card) return;
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const col = await createCollection(name);
      await addToCollection(card, col.id);
      if (!isSaved) track(card.articleId, 'save');
      setNewName('');
    } catch {
      // Limit reached or empty name — silent fail; could surface a toast later
    } finally {
      setCreating(false);
    }
  };

  const onToggleSaveTop = async () => {
    if (!card) return;
    const nowSaved = await toggleSaved(card);
    if (nowSaved) track(card.articleId, 'save');
  };

  const onToggleCollection = async (collectionId: string, currentlyIn: boolean) => {
    if (!card) return;
    if (currentlyIn) {
      await removeFromCollection(card.articleId, collectionId);
    } else {
      await addToCollection(card, collectionId);
      if (!isSaved) track(card.articleId, 'save');
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable
        onPress={onClose}
        accessibilityLabel="Close"
        className="flex-1 bg-knowverse-deep/80"
      />
      <View
        style={{ paddingBottom: insets.bottom + 16 }}
        className="absolute bottom-0 left-0 right-0 rounded-t-3xl border border-knowverse-star/10 bg-knowverse-deep px-5 pt-4"
      >
        <View className="self-center h-1 w-12 rounded-full bg-knowverse-star/20" />
        <Text className="text-knowverse-star/60 mt-4 text-xs uppercase tracking-widest">
          Save to…
        </Text>

        <Pressable
          onPress={() => void onToggleSaveTop()}
          className="mt-3 flex-row items-center justify-between rounded-xl bg-knowverse/60 px-4 py-3"
        >
          <Text className="text-knowverse-star text-base">All Saved</Text>
          <Text className={`text-lg ${isSaved ? 'text-knowverse-star' : 'text-knowverse-star/30'}`}>
            {isSaved ? '★' : '☆'}
          </Text>
        </Pressable>

        <ScrollView
          className="mt-3 max-h-72"
          contentContainerStyle={{ paddingBottom: 4 }}
        >
          {collections.map((c) => {
            const inCollection = card !== null && c.articleIds.includes(card.articleId);
            return (
              <Pressable
                key={c.id}
                onPress={() => void onToggleCollection(c.id, inCollection)}
                className="mt-2 flex-row items-center justify-between rounded-xl bg-knowverse/30 px-4 py-3"
              >
                <Text className="text-knowverse-star flex-1 text-base" numberOfLines={1}>
                  {c.name}
                </Text>
                <Text
                  className={`text-knowverse-star/50 mr-3 text-xs`}
                >
                  {c.articleIds.length}
                </Text>
                <Text
                  className={`text-lg ${inCollection ? 'text-knowverse-star' : 'text-knowverse-star/30'}`}
                >
                  {inCollection ? '✓' : '+'}
                </Text>
              </Pressable>
            );
          })}
          {collections.length === 0 && (
            <Text className="text-knowverse-star/40 mt-3 text-center text-xs">
              No collections yet — create one below.
            </Text>
          )}
        </ScrollView>

        <View className="mt-4 flex-row items-center gap-2 border-t border-knowverse-star/10 pt-4">
          <TextInput
            value={newName}
            onChangeText={setNewName}
            placeholder="New collection name"
            placeholderTextColor="rgba(231, 233, 255, 0.3)"
            returnKeyType="done"
            onSubmitEditing={() => void onCreate()}
            editable={!creating}
            className="text-knowverse-star bg-knowverse/40 flex-1 rounded-xl px-4 py-3 text-base"
          />
          <Pressable
            onPress={() => void onCreate()}
            disabled={!newName.trim() || creating}
            className={`rounded-full px-5 py-3 ${
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

        <Pressable onPress={onClose} className="mt-4 py-2">
          <Text className="text-knowverse-star/60 text-center text-sm">Done</Text>
        </Pressable>
      </View>
    </Modal>
  );
}
