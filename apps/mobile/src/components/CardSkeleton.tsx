import { useEffect } from 'react';
import { useWindowDimensions, View } from 'react-native';
import Animated, {
  type AnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import type { ViewProps } from 'react-native';

const AnimatedView = Animated.View as unknown as React.ComponentType<
  AnimatedProps<ViewProps> & { children?: React.ReactNode }
>;

// Card-shaped placeholder that pulses gently while we fetch the first
// batch. Replaces the bare ActivityIndicator. The shimmer is opacity-
// only (no gradient sweep) — costs ~nothing and reads as "loading"
// without being noisy.
export function CardSkeleton() {
  const { width, height } = useWindowDimensions();
  const imageHeight = Math.min(width * 0.62, height * 0.45);
  const pulse = useSharedValue(0.4);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(0.7, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [pulse]);

  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <View className="flex-1 bg-knowverse-deep">
      <AnimatedView style={[{ width, height: imageHeight, backgroundColor: '#0a1234' }, pulseStyle]} />
      <View className="px-6 pt-8">
        <AnimatedView
          style={[{ height: 30, width: width * 0.65, backgroundColor: '#0f1740', borderRadius: 6 }, pulseStyle]}
        />
        <AnimatedView
          style={[
            { height: 14, width: width * 0.35, backgroundColor: '#0c1233', borderRadius: 4, marginTop: 14 },
            pulseStyle,
          ]}
        />
        <AnimatedView
          style={[
            { height: 14, width: width * 0.88, backgroundColor: '#0c1233', borderRadius: 4, marginTop: 24 },
            pulseStyle,
          ]}
        />
        <AnimatedView
          style={[
            { height: 14, width: width * 0.82, backgroundColor: '#0c1233', borderRadius: 4, marginTop: 8 },
            pulseStyle,
          ]}
        />
        <AnimatedView
          style={[
            { height: 14, width: width * 0.45, backgroundColor: '#0c1233', borderRadius: 4, marginTop: 8 },
            pulseStyle,
          ]}
        />
      </View>
    </View>
  );
}
