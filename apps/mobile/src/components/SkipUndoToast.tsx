import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { ViewProps } from 'react-native';
import Animated, {
  type AnimatedProps,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const AnimatedView = Animated.View as unknown as React.ComponentType<
  AnimatedProps<ViewProps> & { children?: React.ReactNode }
>;

const VISIBLE_MS = 4000;
const FADE_MS = 220;

// Toast that drops in after a quick-skip. Tapping "Undo" goes back to
// the previous card; auto-dismisses after 4s. Tappable area is full-
// width so it's hard to miss in the moment.
export function SkipUndoToast({
  visible,
  bottom,
  onUndo,
  onDismiss,
}: {
  visible: boolean;
  bottom: number;
  onUndo: () => void;
  onDismiss: () => void;
}) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);

  useEffect(() => {
    if (!visible) {
      opacity.value = withTiming(0, { duration: FADE_MS });
      translateY.value = withTiming(20, { duration: FADE_MS });
      return;
    }
    opacity.value = withTiming(1, { duration: FADE_MS });
    translateY.value = withTiming(0, { duration: FADE_MS, easing: Easing.out(Easing.cubic) });
    const t = setTimeout(() => {
      // Animate out, then notify parent that we should be unmounted.
      opacity.value = withTiming(0, { duration: FADE_MS });
      translateY.value = withTiming(20, { duration: FADE_MS }, (finished) => {
        if (finished) runOnJS(onDismiss)();
      });
    }, VISIBLE_MS);
    return () => clearTimeout(t);
  }, [visible, opacity, translateY, onDismiss]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  if (!visible) return null;

  return (
    <AnimatedView
      style={[
        style,
        { position: 'absolute', left: 16, right: 16, bottom },
      ]}
    >
      <View className="flex-row items-center justify-between rounded-full bg-black/80 border border-white/10 pl-5 pr-2 py-2">
        <Text className="text-white/85 text-sm">Card skipped fast — bring it back?</Text>
        <Pressable
          onPress={onUndo}
          className="bg-knowverse-star ml-3 rounded-full px-4 py-1.5"
          hitSlop={8}
        >
          <Text className="text-knowverse-deep text-xs font-semibold">Undo</Text>
        </Pressable>
      </View>
    </AnimatedView>
  );
}
