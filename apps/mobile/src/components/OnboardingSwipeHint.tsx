import { useEffect } from 'react';
import { Text, View } from 'react-native';
import type { ViewProps } from 'react-native';
import { Feather as RawFeather } from '@expo/vector-icons';
import Animated, {
  type AnimatedProps,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

type FeatherProps = { name: string; size?: number; color?: string };
const Feather = RawFeather as unknown as React.ComponentType<FeatherProps>;
const AnimatedView = Animated.View as unknown as React.ComponentType<
  AnimatedProps<ViewProps> & { children?: React.ReactNode }
>;

// Renders an animated "swipe up" hint over the first card. The chevron
// floats up + fades repeatedly. Caller passes `bottom` so the hint
// floats above the action stack.
export function OnboardingSwipeHint({ bottom }: { bottom: number }) {
  const ty = useSharedValue(0);
  const opacity = useSharedValue(0.85);

  useEffect(() => {
    ty.value = withRepeat(
      withSequence(
        withTiming(-22, { duration: 850, easing: Easing.out(Easing.cubic) }),
        withTiming(0, { duration: 0 }),
      ),
      -1,
      false,
    );
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.2, { duration: 850, easing: Easing.out(Easing.cubic) }),
        withTiming(0.85, { duration: 0 }),
      ),
      -1,
      false,
    );
  }, [ty, opacity]);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: ty.value }],
    opacity: opacity.value,
  }));

  return (
    <View
      style={{ position: 'absolute', left: 0, right: 0, bottom, alignItems: 'center' }}
      pointerEvents="none"
    >
      <AnimatedView style={chevronStyle}>
        <Feather name="chevron-up" size={36} color="#ffffff" />
      </AnimatedView>
      <Text
        className="text-white/85 mt-2 text-[13px] font-medium tracking-wider"
        style={{ textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 6 }}
      >
        Swipe up for the next one
      </Text>
    </View>
  );
}
