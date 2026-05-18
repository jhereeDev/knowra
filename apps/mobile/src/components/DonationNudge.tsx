import { Linking, Pressable, Text, View } from 'react-native';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';
import { LinearGradient as RawLinearGradient } from 'expo-linear-gradient';
import { Feather as RawFeather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tapImpact } from '@/lib/haptics';

// Same React-19 JSX-class cast pattern as expo-image / Animated.View.
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
type FeatherProps = { name: string; size?: number; color?: string; style?: StyleProp<TextStyle> };
const Feather = RawFeather as unknown as React.ComponentType<FeatherProps>;

const WIKIPEDIA_DONATE_URL = 'https://donate.wikimedia.org';

/**
 * In-stream Wikipedia donation prompt that occupies a full pager slot.
 * Triggered every ~50 card impressions (see lib/nudgeCounter.ts) and
 * dismissed by swiping past it — same gesture as any other card. Copy
 * mirrors product spec §4.11.
 *
 * Visual treatment:
 *   - No hero photo — soft star-tinted radial gradient instead so it
 *     reads as "a different kind of card" without breaking the pager
 *     rhythm.
 *   - Centered single-column copy, max-width capped for tablet sanity.
 *   - Two CTAs: "Donate to Wikipedia" (primary) and "Maybe later"
 *     (secondary, dismisses by advancing past the nudge).
 */
export function DonationNudge({ onDismiss }: { onDismiss: () => void }) {
  const insets = useSafeAreaInsets();

  const onDonate = async () => {
    tapImpact();
    await Linking.openURL(WIKIPEDIA_DONATE_URL);
    // Don't auto-advance — the user may want to return to where they were.
  };

  const onLater = () => {
    tapImpact();
    onDismiss();
  };

  return (
    <View className="flex-1 bg-knowverse-deep">
      {/* Two stacked gradients: vertical from deep → mid for the "sky",
          plus a softer center-glow effect via opacity layering. Pure
          linear gradients on RN — no Skia needed for this. */}
      <LinearGradient
        colors={['#0a1234', '#06092a', '#05071a']}
        locations={[0, 0.55, 1]}
        style={{ position: 'absolute', inset: 0 }}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['rgba(168,180,255,0.18)', 'rgba(168,180,255,0)']}
        locations={[0, 0.6]}
        start={{ x: 0.5, y: 0.2 }}
        end={{ x: 0.5, y: 0.7 }}
        style={{ position: 'absolute', inset: 0 }}
        pointerEvents="none"
      />

      <View
        className="flex-1 items-center justify-center px-7"
        style={{ paddingTop: insets.top + 48, paddingBottom: insets.bottom + 48 }}
      >
        <View
          className="items-center"
          style={{ maxWidth: 420 }}
        >
          {/* Soft icon medallion to anchor the visual */}
          <View className="mb-7 h-16 w-16 items-center justify-center rounded-full border border-knowverse-star/25 bg-black/30">
            <Feather name="heart" size={26} color="#a8b4ff" />
          </View>

          <Text className="text-knowverse-star text-[12px] uppercase tracking-[3px] mb-3 opacity-70">
            A note from Knowra
          </Text>

          <Text className="text-white text-[24px] font-semibold text-center leading-[32px]">
            100% of what you just read was written by volunteers.
          </Text>

          <Text className="text-knowverse-star/75 mt-4 text-center text-[16px] leading-[24px]">
            We donate 5% of our revenue to the Wikimedia Foundation. Want to add
            yours?
          </Text>

          <Pressable
            onPress={() => void onDonate()}
            accessibilityLabel="Open Wikipedia donate page"
            className="mt-8 flex-row items-center gap-2 rounded-full bg-knowverse-star px-6 py-3"
            style={{
              shadowColor: '#000',
              shadowOpacity: 0.3,
              shadowRadius: 14,
              shadowOffset: { width: 0, height: 4 },
            }}
          >
            <Feather name="external-link" size={16} color="#05071a" />
            <Text className="text-knowverse-deep text-[15px] font-semibold">
              Donate to Wikipedia
            </Text>
          </Pressable>

          <Pressable
            onPress={onLater}
            accessibilityLabel="Dismiss donation nudge"
            className="mt-4 rounded-full border border-knowverse-star/20 px-5 py-2"
            hitSlop={8}
          >
            <Text className="text-knowverse-star/80 text-[13px]">Maybe later</Text>
          </Pressable>
        </View>
      </View>

      {/* Hint that the gesture still works — keeps the pager affordance
          discoverable even on the nudge card. */}
      <View
        className="absolute left-0 right-0 items-center"
        style={{ bottom: insets.bottom + 14 }}
        pointerEvents="none"
      >
        <Text className="text-knowverse-star/35 text-[10px] uppercase tracking-[2px]">
          swipe up to continue
        </Text>
      </View>
    </View>
  );
}
