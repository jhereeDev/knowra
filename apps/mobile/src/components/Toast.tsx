import { useEffect } from 'react';
import { Text } from 'react-native';
import type { ViewProps } from 'react-native';
import Animated, {
  type AnimatedProps,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useToast } from '@/lib/toast';

const AnimatedView = Animated.View as unknown as React.ComponentType<
  AnimatedProps<ViewProps> & { children?: React.ReactNode }
>;

// Global toast — renders whatever the most recent `showToast()` call
// pushed. Caller decides duration; this component just animates.
export function Toast({ bottom }: { bottom: number }) {
  const toast = useToast();
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);

  useEffect(() => {
    if (toast) {
      opacity.value = withTiming(1, { duration: 180 });
      translateY.value = withTiming(0, { duration: 220, easing: Easing.out(Easing.cubic) });
    } else {
      opacity.value = withTiming(0, { duration: 180 });
      translateY.value = withTiming(20, { duration: 180 });
    }
  }, [toast, opacity, translateY]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  if (!toast) return null;

  return (
    <AnimatedView
      pointerEvents="none"
      style={[
        style,
        {
          position: 'absolute',
          left: 24,
          right: 24,
          bottom,
        },
      ]}
    >
      <Text
        className="self-center rounded-full bg-black/85 border border-white/10 px-5 py-2.5 text-white text-sm font-medium"
        style={{ textAlign: 'center' }}
      >
        {toast.text}
      </Text>
    </AnimatedView>
  );
}
