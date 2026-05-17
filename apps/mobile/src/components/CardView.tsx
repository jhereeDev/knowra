import { useState } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  Share,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import type { StyleProp, TextStyle, ViewProps, ViewStyle } from 'react-native';
import { Image as RawExpoImage, type ImageProps as ExpoImageProps } from 'expo-image';
import { LinearGradient as RawLinearGradient } from 'expo-linear-gradient';
import Animated, { type AnimatedProps, useAnimatedStyle } from 'react-native-reanimated';
import { usePagerTranslateY } from '@/components/PagerContext';

// expo-linear-gradient's LinearGradient class type doesn't satisfy
// React 19's JSX constraint (same recurring issue as expo-image et al).
type LinearGradientProps = {
  colors: readonly [string, string, ...string[]];
  locations?: readonly number[];
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  style?: StyleProp<ViewStyle>;
  pointerEvents?: 'auto' | 'none' | 'box-none' | 'box-only';
  children?: React.ReactNode;
};
const LinearGradient = RawLinearGradient as unknown as React.ComponentType<LinearGradientProps>;

// Reanimated AnimatedView shim (same recurring React-19 cast as VerticalPager).
const AnimatedView = Animated.View as unknown as React.ComponentType<
  AnimatedProps<ViewProps> & { children?: React.ReactNode }
>;

// Parallax factor: image moves at (1 - factor) of the pager's rate, so
// during a swipe-up the image appears to lag. 0.2 is subtle and reads as
// depth without feeling broken.
const PARALLAX_FACTOR = 0.2;

import { Feather as RawFeather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Card } from '@knowra/shared';
import { track } from '@/lib/events';
import { toggleSaved, useSavedIds } from '@/lib/savedArticles';
import { CollectionPicker } from '@/components/CollectionPicker';
import { ArticleReader } from '@/components/ArticleReader';
import { pressAndHold, tapImpact } from '@/lib/haptics';
import { showToast } from '@/lib/toast';

// React-19 JSX-class shims — same recurring pattern.
const Image = RawExpoImage as unknown as React.ComponentType<ExpoImageProps>;
type FeatherIconProps = {
  name: string;
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
};
const Feather = RawFeather as unknown as React.ComponentType<FeatherIconProps>;

// Image fills this much of the screen height regardless of the source
// aspect ratio. Pinned constant gives every card the same anchor point
// for the title overlay — predictable rhythm beats fitted-to-image.
const IMAGE_HEIGHT_FRACTION = 0.62;

export function CardView({
  card,
  onInjectRelated,
}: {
  card: Card;
  // When provided, the reader's "More like this" CTA shows; tap injects
  // related cards into the feed via this callback.
  onInjectRelated?: (cards: Card[]) => number;
}) {
  const { width, height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const imageHeight = screenHeight * IMAGE_HEIGHT_FRACTION;

  const savedIds = useSavedIds();
  const isSaved = savedIds.has(card.articleId);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [readerOpen, setReaderOpen] = useState(false);

  // Pager parallax: when the user swipes (pagerTY changes), the hero
  // image counter-translates by PARALLAX_FACTOR so it appears to move
  // slightly slower than the rest of the card. usePagerTranslateY
  // returns null outside a pager — fall back to a no-op style.
  const pagerTY = usePagerTranslateY();
  const parallaxStyle = useAnimatedStyle(() => {
    if (!pagerTY) return {};
    // pagerTY < 0 when swiping up; we want the image to appear to lag,
    // so we add a positive translateY equal to a fraction of -pagerTY.
    return { transform: [{ translateY: -pagerTY.value * PARALLAX_FACTOR }] };
  });

  const onToggleSave = async () => {
    tapImpact();
    const nowSaved = await toggleSaved(card);
    if (nowSaved) track(card.articleId, 'save');
  };

  const openPicker = () => {
    pressAndHold();
    setPickerOpen(true);
  };

  const onShare = async () => {
    tapImpact();
    track(card.articleId, 'share');
    const plainTitle = card.title.replace(/<[^>]+>/g, '');
    await Share.share({
      message: `${plainTitle} — ${card.wikipediaUrl}`,
      url: card.wikipediaUrl,
      title: plainTitle,
    });
  };

  const onGoDeeper = () => {
    tapImpact();
    track(card.articleId, 'go_deeper');
    // Open the in-app reader instead of bouncing to the browser. The
    // reader has an "Open in browser" escape hatch in its header.
    setReaderOpen(true);
  };

  return (
    <View className="flex-1 bg-knowverse-deep">
      {/* ---------- Hero image + gradient + title overlay ---------- */}
      <View
        style={{ width, height: imageHeight, position: 'relative', overflow: 'hidden' }}
      >
        {card.image ? (
          <AnimatedView style={parallaxStyle}>
            <Image
              source={{ uri: card.image.url }}
              recyclingKey={card.articleId}
              style={{
                width,
                // Extra height so the parallax translate doesn't reveal
                // the background. The hero box clips with overflow:hidden.
                height: imageHeight * 1.15,
                backgroundColor: card.image.dominantColor ?? '#0a0e27',
              }}
              placeholder={card.image.dominantColor ? { uri: undefined } : undefined}
              contentFit="cover"
              transition={250}
              accessibilityLabel={card.title}
            />
          </AnimatedView>
        ) : (
          // No image — gradient placeholder using a knowverse-tinted block
          <View
            style={{ width, height: imageHeight, backgroundColor: '#0a1234' }}
            className="items-center justify-center"
          >
            <Feather name="image" size={36} color="rgba(231,233,255,0.18)" />
          </View>
        )}

        {/* Dark gradient at bottom of image — pulls focus to the title */}
        <LinearGradient
          colors={['transparent', 'rgba(5,7,26,0.55)', 'rgba(5,7,26,1)']}
          locations={[0.45, 0.78, 1]}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: imageHeight * 0.75,
          }}
          pointerEvents="none"
        />

        {/* Wikipedia source attribution lives in the bottom divider —
            no top badge here (was overlapping the feed-tab chrome). */}

        {/* Bottom-left: title + subtitle on the gradient */}
        <View
          style={{
            position: 'absolute',
            left: 20,
            right: 88, // leave room for the right-edge action stack
            bottom: 18,
          }}
        >
          {/* Category chips — derived from the article's description.
              Up to 2 to keep visual noise low. */}
          {card.categories.length > 0 && (
            <View className="mb-2 flex-row flex-wrap gap-1.5">
              {card.categories.slice(0, 2).map((cat) => (
                <View
                  key={cat}
                  className="rounded-full border border-white/25 bg-black/40 px-2.5 py-0.5"
                >
                  <Text className="text-white/85 text-[10px] font-medium uppercase tracking-wider">
                    {cat}
                  </Text>
                </View>
              ))}
            </View>
          )}
          {card.subtitle && (
            <Text className="text-knowverse-star/70 mb-2 text-[11px] font-medium uppercase tracking-[2px]">
              {card.subtitle}
            </Text>
          )}
          <Text
            className="text-white text-[28px] font-bold leading-tight"
            style={{ textShadowColor: 'rgba(0,0,0,0.4)', textShadowRadius: 8 }}
          >
            {card.title}
          </Text>
        </View>
      </View>

      {/* ---------- Hook + attribution below image ---------- */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingTop: 22,
          paddingBottom: insets.bottom + 32,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Text className="text-knowverse-star/90 text-[17px] leading-[26px]">
          {card.hook}
        </Text>

        <View className="mt-6 flex-row items-center gap-2">
          <View className="h-px flex-1 bg-knowverse-star/10" />
          <Text className="text-knowverse-star/40 text-[10px] uppercase tracking-[1.5px]">
            {card.attribution}
          </Text>
          <View className="h-px flex-1 bg-knowverse-star/10" />
        </View>
      </ScrollView>

      {/* ---------- Right-edge action stack ---------- */}
      <View
        style={{
          position: 'absolute',
          right: 14,
          bottom: insets.bottom + 24,
          alignItems: 'center',
          gap: 18,
        }}
      >
        <ActionButton
          icon={isSaved ? 'bookmark' : 'bookmark'}
          label={isSaved ? 'Saved' : 'Save'}
          onPress={() => void onToggleSave()}
          onLongPress={openPicker}
          active={isSaved}
        />
        <ActionButton icon="share-2" label="Share" onPress={() => void onShare()} />
        <ActionButton icon="external-link" label="Open" onPress={onGoDeeper} />
      </View>

      <CollectionPicker
        card={pickerOpen ? card : null}
        onClose={() => setPickerOpen(false)}
      />
      <ArticleReader
        card={readerOpen ? card : null}
        onClose={() => setReaderOpen(false)}
        onMoreLikeThis={
          onInjectRelated
            ? (related) => {
                const count = onInjectRelated(related);
                if (count > 0) {
                  showToast(
                    count === 1
                      ? '1 related article added — swipe up'
                      : `${count} related articles added — swipe up`,
                  );
                } else {
                  showToast('No new related articles');
                }
              }
            : undefined
        }
      />
    </View>
  );
}

function ActionButton({
  icon,
  label,
  onPress,
  onLongPress,
  active = false,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  onLongPress?: () => void;
  active?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={300}
      accessibilityLabel={label}
      className="items-center"
      hitSlop={8}
    >
      <View
        className={`h-12 w-12 items-center justify-center rounded-full border ${
          active
            ? 'bg-knowverse-star border-knowverse-star'
            : 'bg-black/45 border-white/15'
        }`}
      >
        <Feather
          name={icon}
          size={22}
          color={active ? '#05071a' : '#e7e9ff'}
          style={
            active && icon === 'bookmark'
              ? { /* solid-fill effect via overlay below */ }
              : undefined
          }
        />
      </View>
      <Text
        className="text-white/85 mt-1.5 text-[11px] font-medium"
        style={{ textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 4 }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
